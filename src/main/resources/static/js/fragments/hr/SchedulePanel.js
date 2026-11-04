// Bước 4 — Xếp lịch: lưới nhân viên × ca theo ngày, phân ca hàng loạt, đổi/xoá ca.
// Quy tắc backend: mỗi nhân viên chỉ 1 ca/ngày, không xếp cho ngày đã qua.
import { hr, attState, hm, ymd, addDays, parseYmd } from '../../services/HrService.js';
import { openDialog, confirmDialog } from '../../utils/dialog.js';
import { HrPanel, esc, INPUT_CLS, CARD, TH, field, notice, emptyState, bindActions, toast, WEEKDAY, dayLabel, clock, isToday, cap } from './ui.js';
import { ICONS } from '../../icon.js';

// Khớp ca theo id; nếu backend không trả id của ca trong lịch thì khớp theo tên + giờ.
const sameShift = (sch, sh) => sch.shiftId != null
    ? sch.shiftId === sh.id
    : sch.shiftName === sh.name && sch.startTime === hm(sh.startTime) && sch.endTime === hm(sh.endTime);

const weekStart = s => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };

class SchedulePanel extends HrPanel {
    state = { date: ymd(), staff: [], shifts: [], week: [] };

    build() {
        this.innerHTML = `
        <div class="flex flex-col gap-4">
            <div data-banner></div>
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" data-act="prev" aria-label="Ngày trước" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevL}</button>
                    <span data-date class="min-w-44 rounded-lg border border-primary-100 bg-white px-4 py-1.5 text-center text-sm font-bold text-primary-800"></span>
                    <button type="button" data-act="next" aria-label="Ngày sau" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevR}</button>
                    <p-button data-act="today" label="Hôm nay"></p-button>
                    <input type="date" data-pick aria-label="Chọn ngày" class="${INPUT_CLS} !w-auto !py-1.5 text-sm">
                </div>
                <p-button data-act="assign" label="Phân ca làm mới" icon="add" variant="solid"></p-button>
            </div>
            <div data-week class="grid grid-cols-7 gap-2"></div>
            <section class="${CARD} !p-0 overflow-hidden"><div data-table class="overflow-x-auto"></div></section>
        </div>`;
    }

    async load() {
        const s = this.state;
        const from = weekStart(s.date), to = addDays(from, 6);
        const [staff, shifts, week] = await Promise.all([hr.listStaff(), hr.listShifts(), hr.listScheduleRange(from, to)]);
        s.staff = staff.filter(x => x.status === 'ACTIVE');
        // Nhân viên đã nghỉ việc vẫn có thể còn ca đã xếp (backend không tự huỷ) -> vẫn hiện hàng của họ để quản lý xoá ca.
        const known = new Set(s.staff.map(x => x.id));
        for (const w of week) {
            if (w.employmentId != null && !known.has(w.employmentId)) {
                known.add(w.employmentId);
                const gone = staff.find(x => x.id === w.employmentId);
                s.staff.push({ id: w.employmentId, name: `${w.staffName}${gone ? ' (đã nghỉ)' : ''}`, roleNames: gone?.roleNames ?? [], status: 'ACTIVE', roleIds: [], gone: Boolean(gone) });
            }
        }
        s.shifts = shifts.filter(x => x.status === 'ACTIVE').sort((a, b) => hm(a.startTime).localeCompare(hm(b.startTime)));
        s.week = week;
    }

    get today() { return this.state.week.filter(x => x.date === this.state.date); }

    draw() {
        const s = this.state;
        this.querySelector('[data-date]').textContent = dayLabel(s.date);
        this.querySelector('[data-pick]').value = s.date;
        const ready = s.staff.some(x => !x.gone) && s.shifts.length;
        const orphan = this.today.filter(x => x.employmentId == null || !s.shifts.some(sh => sameShift(x, sh)));
        if (orphan.length) console.warn('[Schedule] Lịch không khớp được nhân viên/ca, dữ liệu backend trả về:', orphan);
        this.querySelector('[data-banner]').innerHTML = orphan.length
            ? notice(`Có ${orphan.length} ca trong ngày nhưng backend không trả đủ <code>employmentResponse.id</code> hoặc <code>shift.id</code> (hoặc ca đã ngưng dùng) nên không vẽ được lên lưới. Mở tab Network, xem response của <code>GET /work-schedule/…?date=</code>.`)
            : !s.staff.some(x => !x.gone)
            ? notice('Chưa có nhân viên đang làm. <a href="#staff" class="font-bold underline">Thêm nhân viên ở bước 2</a> trước khi xếp lịch.')
            : !s.shifts.length ? notice('Chưa có ca kíp. <a href="#shifts" class="font-bold underline">Tạo ca ở bước 3</a> trước khi xếp lịch.') : '';
        this.querySelector('[data-act="assign"]').toggleAttribute('disabled', !ready);

        const start = weekStart(s.date);
        this.querySelector('[data-week]').innerHTML = Array.from({ length: 7 }, (_, i) => {
            const d = addDays(start, i), n = s.week.filter(x => x.date === d).length, on = d === s.date;
            return `<button type="button" data-act="day" data-d="${d}" aria-pressed="${on}" class="cursor-pointer rounded-xl border px-2 py-2 text-center transition-all hover:scale-[0.98]
                ${on ? 'border-primary-600 bg-primary-600 text-white' : 'border-primary-100 bg-white text-secondary-800'}">
                <span class="block text-xs font-semibold opacity-80">${WEEKDAY[parseYmd(d).getDay()].replace('Chủ nhật', 'CN')}</span>
                <span class="block text-base font-bold">${parseYmd(d).getDate()}</span>
                <span class="block text-xs ${on ? 'text-white/80' : 'text-secondary-700'}">${n ? `${n} ca` : 'Trống'}</span></button>`;
        }).join('');

        const byEmp = new Map(this.today.map(x => [x.employmentId, x]));
        const editable = s.date >= ymd();
        this.querySelector('[data-table]').innerHTML = ready ? `
            <table class="w-full min-w-170 text-sm">
                <thead class="bg-secondary-50"><tr>
                    <th class="${TH}">Nhân viên</th>
                    ${s.shifts.map(sh => `<th class="${TH} text-center">${esc(sh.name)}</th>`).join('')}
                    <th class="${TH}"><span class="sr-only">Thao tác</span></th>
                </tr></thead>
                <tbody>${s.staff.map(st => {
                    const sch = byEmp.get(st.id);
                    return `<tr class="border-t border-primary-50">
                        <th scope="row" class="px-3 py-3 text-left"><span class="block font-bold">${esc(st.name)}</span>
                            <span class="text-xs font-medium text-secondary-700">${esc((st.roleNames ?? []).map(cap).join(', ') || '—')}</span></th>
                        ${s.shifts.map(sh => `<td class="px-1.5 py-2">${this.cell(st, sh, sch, editable)}</td>`).join('')}
                        <td class="px-3 py-3 text-right"><p-button data-act="remove" data-id="${sch?.id ?? ''}" label="Xoá" icon="delete" variant="danger"
                            ${!sch || !editable || sch.attendances.length ? 'disabled' : ''}></p-button></td></tr>`;
                }).join('')}</tbody>
            </table>` : emptyState(this.loading ? 'Đang tải…' : 'Chưa thể xếp lịch', 'Cần có ít nhất 1 nhân viên đang làm và 1 ca kíp.');
    }

    cell(st, sh, sch, editable) {
        const label = `${sh.name} (${hm(sh.startTime)} - ${hm(sh.endTime)})`;
        if (sch && sameShift(sch, sh)) {
            const a = attState(sch);
            const bad = a.code === 'LATE' || (a.code === 'DONE' && a.late) || a.code === 'ABSENT';
            const note = a.code === 'ABSENT' ? 'Vắng' : a.late ? `Đi muộn (${clock(a.inAt)})` : a.code === 'DONE' ? `Ra ca ${clock(a.outAt)}` : a.code === 'ONTIME' ? `Vào ca ${clock(a.inAt)}` : '';
            return `<div class="grid min-h-12 place-items-center rounded-xl px-2 py-1.5 text-center text-xs font-bold ${bad ? 'bg-red-100 text-red-800' : 'bg-secondary-50 text-primary-800'}">
                <span>${bad && a.late ? esc(note) : esc(label)}</span>${note && !(bad && a.late) ? `<span class="font-medium opacity-80">${esc(note)}</span>` : ''}</div>`;
        }
        const swap = sch && editable && !sch.attendances.length;
        if (!st.gone && ((!sch && editable) || swap)) {
            return `<button type="button" data-act="quick" data-emp="${st.id}" data-shift="${sh.id}" ${swap ? `data-sch="${sch.id}"` : ''}
                title="${swap ? 'Đổi sang' : 'Xếp'} ${esc(label)}" aria-label="${swap ? 'Đổi' : 'Xếp'} ${esc(st.name)} vào ${esc(sh.name)}"
                class="group grid min-h-12 w-full cursor-pointer place-items-center rounded-xl bg-neutral-100 px-2 py-1.5 text-xs font-bold text-secondary-700 transition-all hover:bg-primary-50 hover:text-primary-700">
                <span class="group-hover:hidden">${swap ? '—' : 'Nghỉ'}</span><span class="hidden group-hover:inline">+ ${swap ? 'Đổi sang ca này' : 'Xếp ca này'}</span></button>`;
        }
        return `<div class="grid min-h-12 place-items-center rounded-xl bg-neutral-100 px-2 py-1.5 text-xs font-bold text-secondary-700">${sch ? '—' : 'Nghỉ'}</div>`;
    }

    go(date) { this.state.date = date; this.reload(); }

    onChange(e) { if (e.target.matches('[data-pick]') && e.target.value) this.go(e.target.value); }

    assignDialog() {
        const { shifts } = this.state;
        const staff = this.state.staff.filter(x => !x.gone);
        return openDialog({
            title: 'Phân ca làm mới', width: 520,
            render: (body, close) => {
                body.innerHTML = `
                <form class="grid gap-4" novalidate>
                    ${field('Ngày', `<input type="date" name="date" min="${ymd()}" value="${this.state.date < ymd() ? ymd() : this.state.date}" class="${INPUT_CLS}" required>`)}
                    <fieldset class="grid gap-2"><legend class="mb-1.5 text-sm font-semibold">Ca làm (mỗi nhân viên một ca trong ngày)</legend>
                        <div class="grid gap-2 sm:grid-cols-3">${shifts.map((sh, i) => `
                            <label class="cursor-pointer"><input type="radio" name="shift" value="${sh.id}" ${i === 0 ? 'checked' : ''} class="peer sr-only">
                                <span class="grid rounded-xl border-2 border-primary-100 px-3 py-2 text-center text-sm font-bold transition-all peer-checked:border-primary-600 peer-checked:bg-primary-50 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300">
                                    ${esc(sh.name)}<span class="text-xs font-medium text-secondary-700">${hm(sh.startTime)} - ${hm(sh.endTime)}</span></span></label>`).join('')}</div>
                    </fieldset>
                    <fieldset class="grid gap-2"><legend class="mb-1.5 flex items-center justify-between text-sm font-semibold">
                        <span>Nhân viên</span><button type="button" data-act="all" class="cursor-pointer text-xs font-bold text-primary-600 underline">Chọn tất cả</button></legend>
                        <div data-staff class="grid max-h-56 gap-1.5 overflow-y-auto sm:grid-cols-2">${staff.map(st => `
                            <label class="flex items-center gap-2 rounded-lg border border-primary-50 px-3 py-2 text-sm font-semibold has-disabled:opacity-50" data-row="${st.id}">
                                <input type="checkbox" name="emp" value="${st.id}" class="size-4 cursor-pointer accent-primary"><span>${esc(st.name)}</span><span data-tag class="ml-auto text-xs font-medium text-secondary-700"></span></label>`).join('')}</div>
                    </fieldset>
                    <p data-err role="alert" class="hidden text-sm font-semibold text-red-600"></p>
                    <div class="flex justify-center gap-3 pt-1">
                        <p-button type="submit" label="Lưu chỉnh sửa" icon="check" variant="solid"></p-button>
                        <p-button data-act="cancel" label="Huỷ"></p-button>
                    </div>
                </form>`;
                const form = body.querySelector('form'), err = body.querySelector('[data-err]');
                const fail = m => { err.textContent = m; err.classList.remove('hidden'); };
                const markBusy = async () => {
                    const date = form.elements.date.value;
                    const sch = date ? await hr.listSchedule(date).catch(() => []) : [];
                    const busy = new Set(sch.map(x => x.employmentId));
                    body.querySelectorAll('[data-row]').forEach(r => {
                        const box = r.querySelector('input'), has = busy.has(Number(r.dataset.row));
                        box.disabled = has; if (has) box.checked = false;
                        r.querySelector('[data-tag]').textContent = has ? 'đã có ca' : '';
                    });
                };
                form.elements.date.addEventListener('change', markBusy); markBusy();
                form.addEventListener('submit', e => {
                    e.preventDefault();
                    const f = new FormData(form), date = f.get('date');
                    if (!date) return fail('Chọn ngày');
                    if (date < ymd()) return fail('Không thể phân công cho ngày cũ');
                    const emps = f.getAll('emp').map(Number);
                    if (!emps.length) return fail('Chọn ít nhất 1 nhân viên');
                    close({ date, items: emps.map(employmentId => ({ employmentId, shiftId: Number(f.get('shift')) })) });
                });
                bindActions(body, {
                    all: () => body.querySelectorAll('[name="emp"]:not(:disabled)').forEach(c => { c.checked = true; }),
                    cancel: () => close(),
                });
            },
        });
    }

    actions() {
        return {
            prev: () => this.go(addDays(this.state.date, -1)),
            next: () => this.go(addDays(this.state.date, 1)),
            today: () => this.go(ymd()),
            day: el => this.go(el.dataset.d),
            assign: async () => {
                const r = await this.assignDialog();
                if (!r) return;
                const ok = await this.run(async () => { await hr.assign(r.date, r.items); return true; }, `Đã phân ca cho ${r.items.length} nhân viên`);
                if (ok && r.date !== this.state.date) this.go(r.date);
            },
            quick: el => {
                const emp = Number(el.dataset.emp), shift = Number(el.dataset.shift);
                if (el.dataset.sch) this.run(() => hr.changeShift(Number(el.dataset.sch), shift), 'Đã đổi ca');
                else this.run(() => hr.assign(this.state.date, [{ employmentId: emp, shiftId: shift }]), 'Đã xếp ca');
            },
            remove: async el => {
                const sch = this.today.find(x => x.id === Number(el.dataset.id));
                if (!sch) return;
                const ok = await confirmDialog({ title: 'Xoá ca làm', message: `Xác nhận xoá ca làm của ${sch.staffName} hay không?`, confirmLabel: 'Xoá', confirmIcon: 'delete', variant: 'danger' });
                if (ok) this.run(() => hr.cancelSchedule(sch.id), 'Đã xoá ca làm');
            },
        };
    }
}

customElements.define('hr-schedule', SchedulePanel);
