// Bước 5 — Chấm công: xem giờ vào/ra theo ngày, quản lý duyệt hoặc từ chối công.

import { hr, HR_MODE, attState, hm, ymd, addDays, workedHours } from '../../services/HrService.js';
import { openDialog } from '../../utils/dialog.js';
import { HrPanel, esc, INPUT_CLS, CARD, TH, chip, field, notice, emptyState, bindActions, dayLabel, clock } from './ui.js';
import { ICONS } from '../../icon.js';

const STATE = {
    WAIT: ['Chưa chấm công', 'gray'], ONTIME: ['Đang làm', 'green'], LATE: ['Đi muộn', 'red'],
    DONE: ['Đã ra ca', 'green'], ABSENT: ['Vắng mặt', 'red'],
};
const REVIEW = { PENDING: ['Chờ duyệt', 'amber'], APPROVED: ['Đã duyệt', 'green'], REJECTED: ['Từ chối', 'red'] };

class AttendancePanel extends HrPanel {
    state = { date: ymd(), list: [] };

    build() {
        this.innerHTML = `
        <div class="flex flex-col gap-4">
            <div data-banner></div>
            <div class="flex flex-wrap items-center gap-2">
                <button type="button" data-act="prev" aria-label="Ngày trước" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevL}</button>
                <span data-date class="min-w-44 rounded-lg border border-primary-100 bg-white px-4 py-1.5 text-center text-sm font-bold text-primary-800"></span>
                <button type="button" data-act="next" aria-label="Ngày sau" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevR}</button>
                <p-button data-act="today" label="Hôm nay"></p-button>
                <input type="date" data-pick aria-label="Chọn ngày" class="${INPUT_CLS} !w-auto !py-1.5 text-sm">
            </div>
            <div data-sum class="grid gap-3 sm:grid-cols-4"></div>
            <section class="${CARD} !p-0 overflow-hidden"><div data-table class="overflow-x-auto"></div></section>
        </div>`;
    }

    async load() { this.state.list = (await hr.listSchedule(this.state.date)).sort((a, b) => hm(a.startTime).localeCompare(hm(b.startTime)) || a.staffName.localeCompare(b.staffName)); }

    draw() {
        const { list, date } = this.state;
        this.querySelector('[data-date]').textContent = dayLabel(date);
        this.querySelector('[data-pick]').value = date;
        this.querySelector('[data-banner]').innerHTML = HR_MODE === 'spring'
            ? notice('Backend chưa mở API xem giờ vào/ra và duyệt công (endpoint đang bị chặn quyền, quyền chấm công chưa được seed). Màn hình sẽ đầy đủ khi backend sửa các mục này.') : '';

        const st = list.map(s => attState(s));
        const count = c => st.filter(x => x.code === c).length;
        const pending = list.filter(s => s.attendanceStatus === 'PENDING').length;
        const box = (label, v, tone = '') => `<div class="${CARD} !p-4"><p class="text-xs font-bold uppercase text-secondary-700">${label}</p><p class="mt-1 text-2xl font-bold ${tone}">${v}</p></div>`;
        this.querySelector('[data-sum]').innerHTML = box('Ca trong ngày', list.length) + box('Đang / đã làm', count('ONTIME') + count('LATE') + count('DONE'), 'text-primary-700')
            + box('Đi muộn / vắng', st.filter(x => x.late || x.code === 'ABSENT').length, 'text-red-600') + box('Chờ duyệt', pending, 'text-amber-700');

        this.querySelector('[data-table]').innerHTML = list.length ? `
            <table class="w-full min-w-230 text-sm">
                <thead class="bg-secondary-50"><tr>
                    <th class="${TH}">Nhân viên</th><th class="${TH}">Ca</th><th class="${TH} text-center">Vào</th><th class="${TH} text-center">Ra</th>
                    <th class="${TH} text-center">Giờ làm</th><th class="${TH}">Chấm công</th><th class="${TH}">Duyệt công</th><th class="${TH}"><span class="sr-only">Thao tác</span></th>
                </tr></thead>
                <tbody>${list.map((s, i) => this.row(s, st[i])).join('')}</tbody>
            </table>` : emptyState(this.loading ? 'Đang tải…' : 'Không có ca làm nào trong ngày', 'Xếp lịch ở bước 4 để nhân viên có ca chấm công.');
    }

    row(s, a) {
        const [stLabel, stTone] = STATE[a.code];
        const [rvLabel, rvTone] = REVIEW[s.attendanceStatus] ?? REVIEW.PENDING;
        const pending = s.attendanceStatus === 'PENDING';
        const full = s.attendances.length >= 2 || s.explanation;
        return `<tr class="border-t border-primary-50">
            <th scope="row" class="px-3 py-3 text-left"><span class="block font-bold">${esc(s.staffName)}</span></th>
            <td class="px-3 py-3 whitespace-nowrap">${esc(s.shiftName)} <span class="text-xs text-secondary-700">${hm(s.startTime)} - ${hm(s.endTime)}</span></td>
            <td class="px-3 py-3 text-center tabular-nums ${a.late ? 'font-bold text-red-600' : ''}">${clock(a.inAt)}</td>
            <td class="px-3 py-3 text-center tabular-nums">${clock(a.outAt)}</td>
            <td class="px-3 py-3 text-center tabular-nums">${workedHours(s) ? `${workedHours(s)} giờ` : '—'}</td>
            <td class="px-3 py-3">${chip(stLabel, stTone)}${a.late && a.code !== 'LATE' ? ' ' + chip('Đi muộn', 'red') : ''}</td>
            <td class="px-3 py-3">${chip(rvLabel, rvTone)}${s.rejectReason ? `<span class="mt-1 block max-w-44 truncate text-xs text-red-600" title="${esc(s.rejectReason)}">${esc(s.rejectReason)}</span>` : ''}</td>
            <td class="px-3 py-3"><div class="flex justify-end gap-1.5 whitespace-nowrap">
                ${pending ? `<p-button data-act="approve" data-id="${s.id}" label="Duyệt" icon="check" ${full ? '' : 'disabled'}></p-button>
                    <p-button data-act="reject" data-id="${s.id}" label="Từ chối" icon="close" variant="danger"></p-button>` : ''}
                ${HR_MODE !== 'spring' && s.attendances.length < 2 && s.date === ymd() ? `<p-button data-act="demo" data-id="${s.id}" label="${s.attendances.length ? 'Chấm ra' : 'Chấm vào'}" icon="plus" title="Mô phỏng nhân viên quét QR (chỉ có ở bản demo)"></p-button>` : ''}
            </div></td></tr>`;
    }

    go(date) { this.state.date = date; this.reload(); }
    onChange(e) { if (e.target.matches('[data-pick]') && e.target.value) this.go(e.target.value); }

    rejectDialog(name) {
        return openDialog({
            title: 'Từ chối công', width: 400,
            render: (body, close) => {
                body.innerHTML = `<form class="grid gap-4" novalidate>
                    <p class="text-sm">Lý do từ chối công của <b>${esc(name)}</b>:</p>
                    ${field('Lý do', `<textarea name="reason" rows="3" maxlength="200" class="${INPUT_CLS}" required></textarea>`)}
                    <p data-err role="alert" class="hidden text-sm font-semibold text-red-600">Nhập lý do từ chối</p>
                    <div class="flex justify-center gap-3"><p-button type="submit" label="Từ chối công" icon="close" variant="danger"></p-button><p-button data-act="cancel" label="Huỷ"></p-button></div></form>`;
                const form = body.querySelector('form');
                form.addEventListener('submit', e => {
                    e.preventDefault();
                    const v = form.elements.reason.value.trim();
                    if (!v) body.querySelector('[data-err]').classList.remove('hidden'); else close(v);
                });
                bindActions(body, { cancel: () => close() });
            },
        });
    }

    actions() {
        const find = el => this.state.list.find(x => x.id === Number(el.dataset.id));
        return {
            prev: () => this.go(addDays(this.state.date, -1)),
            next: () => this.go(addDays(this.state.date, 1)),
            today: () => this.go(ymd()),
            approve: el => { const s = find(el); if (s) this.run(() => hr.reviewAttendance(s.id, 'APPROVED'), 'Đã duyệt công'); },
            reject: async el => {
                const s = find(el);
                const reason = s && await this.rejectDialog(s.staffName);
                if (reason) this.run(() => hr.reviewAttendance(s.id, 'REJECTED', reason), 'Đã từ chối công');
            },
            demo: el => { const s = find(el); if (s) this.run(() => hr.demoCheck(s.id), 'Đã ghi nhận chấm công (demo)'); },
        };
    }
}

customElements.define('hr-attendance', AttendancePanel);
