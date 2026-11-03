// Bước 3 — Ca kíp: tạo mẫu ca làm (giờ bắt đầu / kết thúc, hỗ trợ ca qua đêm).

import { hr, HR_MODE, hm, shiftMinutes, isOvernight } from '../../services/HrService.js';
import { openDialog, confirmDialog } from '../../utils/dialog.js';
import { HrPanel, esc, INPUT_CLS, CARD, chip, field, notice, emptyState, bindActions } from './ui.js';

const dur = s => { const m = shiftMinutes(s); return `${Math.floor(m / 60)} giờ${m % 60 ? ` ${m % 60} phút` : ''}`; };

class ShiftPanel extends HrPanel {
    state = { shifts: [], showOff: false };

    build() {
        this.innerHTML = `
        <div class="flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <label class="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <input type="checkbox" data-off class="size-4 accent-primary"> Hiện cả ca đã ngưng dùng</label>
                <p-button data-act="add" label="Thêm ca kíp" icon="add" variant="solid"></p-button>
            </div>
            <div data-grid class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"></div>
        </div>`;
    }

    async load() { this.state.shifts = await hr.listShifts(); }

    onChange(e) { if (e.target.matches('[data-off]')) { this.state.showOff = e.target.checked; this.draw(); } }

    draw() {
        const list = this.state.shifts
            .filter(s => this.state.showOff || s.status === 'ACTIVE')
            .sort((a, b) => hm(a.startTime).localeCompare(hm(b.startTime)));
        this.querySelector('[data-grid]').innerHTML = list.length ? list.map(s => {
            const off = s.status !== 'ACTIVE';
            return `<article class="${CARD} ${off ? 'opacity-60' : ''}">
                <div class="flex items-start justify-between gap-2">
                    <h3 class="text-base font-bold">${esc(s.name)}</h3>
                    ${off ? chip('Ngưng dùng', 'gray') : chip('Đang dùng', 'green')}
                </div>
                <p class="mt-3 text-2xl font-bold tabular-nums text-primary-700">${esc(hm(s.startTime))} <span class="text-primary-300">→</span> ${esc(hm(s.endTime))}</p>
                <p class="mt-1 flex flex-wrap items-center gap-2 text-sm text-secondary-700">${dur(s)} ${isOvernight(s) ? chip('Qua đêm', 'amber') : ''}</p>
                <div class="mt-4 flex gap-2">${off
                    ? `<p-button data-act="activate" data-id="${s.id}" label="Bật lại" icon="check"></p-button>`
                    : `<p-button data-act="edit" data-id="${s.id}" label="Sửa" icon="edit"></p-button>
                       <p-button data-act="delete" data-id="${s.id}" label="Xoá" icon="delete" variant="danger"></p-button>`}</div>
            </article>`;
        }).join('') : `<div class="${CARD} col-span-full">${emptyState(this.loading ? 'Đang tải…' : 'Chưa có ca kíp nào', 'Tạo các ca như Ca Sáng, Ca Chiều, Ca Tối để dùng khi xếp lịch.')}</div>`;
    }

    form(shift) {
        const edit = Boolean(shift);
        return openDialog({
            title: edit ? 'Sửa ca kíp' : 'Thêm ca kíp', width: 440,
            render: (body, close) => {
                body.innerHTML = `
                <form class="grid gap-4" novalidate>
                    ${field('Tên ca', `<input name="name" class="${INPUT_CLS}" maxlength="50" required value="${esc(shift?.name)}" placeholder="VD: Ca Sáng" ${edit && HR_MODE === 'spring' ? 'disabled' : ''}>`,
                        edit && HR_MODE === 'spring' ? 'Backend hiện chỉ cập nhật giờ, chưa đổi được tên ca.' : '')}
                    <div class="grid gap-4 sm:grid-cols-2">
                        ${field('Giờ bắt đầu', `<input name="start" type="time" class="${INPUT_CLS}" required value="${esc(hm(shift?.startTime) || '07:00')}">`)}
                        ${field('Giờ kết thúc', `<input name="end" type="time" class="${INPUT_CLS}" required value="${esc(hm(shift?.endTime) || '11:00')}">`)}
                    </div>
                    <p data-hint class="text-sm text-secondary-700"></p>
                    <p data-err role="alert" class="hidden text-sm font-semibold text-red-600"></p>
                    <div class="flex justify-center gap-3 pt-1">
                        <p-button type="submit" label="Lưu chỉnh sửa" icon="check" variant="solid"></p-button>
                        <p-button data-act="cancel" label="Huỷ"></p-button>
                    </div>
                </form>`;
                const form = body.querySelector('form'), hint = body.querySelector('[data-hint]'), err = body.querySelector('[data-err]');
                const preview = () => {
                    const s = { startTime: form.elements.start.value, endTime: form.elements.end.value };
                    hint.textContent = s.startTime && s.endTime && s.startTime !== s.endTime
                        ? `Thời lượng ${dur(s)}${isOvernight(s) ? ' — ca qua đêm, kết thúc vào ngày hôm sau' : ''}.` : '';
                };
                form.addEventListener('input', preview); preview();
                form.addEventListener('submit', e => {
                    e.preventDefault();
                    const f = new FormData(form);
                    const data = { id: shift?.id, name: String(f.get('name') ?? shift?.name ?? '').trim(), startTime: f.get('start'), endTime: f.get('end') };
                    if (!data.name) { err.textContent = 'Nhập tên ca'; err.classList.remove('hidden'); return; }
                    if (data.startTime === data.endTime) { err.textContent = 'Giờ bắt đầu và kết thúc không được trùng nhau'; err.classList.remove('hidden'); return; }
                    close({ data });
                });
                bindActions(body, { cancel: () => close() });
            },
        });
    }

    actions() {
        const find = el => this.state.shifts.find(s => s.id === Number(el.dataset.id));
        return {
            add: async () => { const r = await this.form(null); if (r) this.run(() => hr.saveShift(r.data), 'Đã thêm ca kíp'); },
            edit: async el => { const s = find(el); const r = s && await this.form(s); if (r) this.run(() => hr.saveShift(r.data), 'Đã lưu ca kíp'); },
            delete: async el => {
                const s = find(el);
                if (!s) return;
                const ok = await confirmDialog({ title: 'Xoá ca kíp', message: `Xác nhận xoá ${s.name} hay không? Ca sẽ ngưng dùng, có thể bật lại sau.`, confirmLabel: 'Xoá', confirmIcon: 'delete', variant: 'danger' });
                if (ok) this.run(() => hr.deleteShift(s.id), 'Đã xoá ca kíp');
            },
            activate: el => this.run(() => hr.activateShift(Number(el.dataset.id)), 'Đã bật lại ca kíp'),
        };
    }
}

customElements.define('hr-shifts', ShiftPanel);
