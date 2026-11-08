// Bước 6 — Tính công: tổng hợp giờ làm đã duyệt theo tháng và ước tính lương.
// Công thức: lương/giờ = lương cơ bản ÷ (số ngày công chuẩn × số giờ/ngày); thực nhận = giờ làm đã duyệt × lương/giờ.

import { hr, HR_MODE, attState, workedHours, parseYmd, ymd } from '../../services/HrService.js';
import { openDialog } from '../../utils/dialog.js';
import { HrPanel, esc, INPUT_CLS, CARD, TH, notice, emptyState, fmtMoney, bindActions } from './ui.js';
import { ICONS } from '../../icon.js';

const PKEY = 'sr:payroll:params';
const readParams = () => { try { return { days: 26, hours: 8, ...JSON.parse(localStorage.getItem(PKEY) ?? '{}') }; } catch { return { days: 26, hours: 8 }; } };
const pad = n => String(n).padStart(2, '0');
const monthRange = (y, m) => ({ from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}` });
const hrs = n => `${Math.round(n * 100) / 100}`.replace('.', ',');

class PayrollPanel extends HrPanel {
    state = { y: new Date().getFullYear(), m: new Date().getMonth(), staff: [], sch: [], params: readParams() };

    build() {
        this.innerHTML = `
        <div class="flex flex-col gap-4">
            <div data-banner></div>
            <div class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end md:justify-between">
                <div class="flex flex-wrap items-center gap-2">
                    <button type="button" data-act="prev" aria-label="Tháng trước" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevL}</button>
                    <span data-month class="min-w-32 rounded-lg border border-primary-100 bg-white px-4 py-1.5 text-center text-sm font-bold text-primary-800"></span>
                    <button type="button" data-act="next" aria-label="Tháng sau" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevR}</button>
                </div>
                <div class="flex flex-wrap items-end gap-3">
                    <label class="grid gap-1 text-xs font-bold">Ngày công chuẩn/tháng
                        <input data-p="days" type="number" min="1" max="31" class="${INPUT_CLS} !w-28 !py-1.5 text-sm"></label>
                    <label class="grid gap-1 text-xs font-bold">Giờ/ngày công
                        <input data-p="hours" type="number" min="1" max="24" step="0.5" class="${INPUT_CLS} !w-28 !py-1.5 text-sm"></label>
                    <p-button data-act="csv" label="Xuất CSV" icon="check" class="block md:inline-block"></p-button>
                </div>
            </div>
            <section class="${CARD} !p-0 overflow-hidden"><div data-table class="overflow-x-auto"></div></section>
            <p class="text-xs text-secondary-700">Chỉ tính các ca đã được <b>duyệt công</b> và có đủ giờ vào/ra. Số liệu là ước tính, chưa gồm thưởng, phạt, phụ cấp hay thuế.</p>
        </div>`;
        const p = this.state.params;
        this.querySelector('[data-p="days"]').value = p.days;
        this.querySelector('[data-p="hours"]').value = p.hours;
    }

    async load() {
        const s = this.state, { from, to } = monthRange(s.y, s.m);
        const [staff, sch] = await Promise.all([hr.listStaff(), hr.listScheduleRange(from, to)]);
        Object.assign(s, { staff, sch });
    }

    rows() {
        const { staff, sch, params } = this.state;
        const hourly = st => st.salary / (Math.max(1, params.days) * Math.max(1, params.hours));
        const ids = new Map(staff.map(x => [x.id, x]));
        sch.forEach(x => { if (!ids.has(x.employmentId)) ids.set(x.employmentId, { id: x.employmentId, name: x.staffName, salary: 0, status: 'ACTIVE' }); });
        return [...ids.values()].map(st => {
            const mine = sch.filter(x => x.employmentId === st.id);
            const ok = mine.filter(x => x.attendanceStatus === 'APPROVED');
            const hours = ok.reduce((t, x) => t + workedHours(x), 0);
            return {
                st, shifts: ok.length, hours,
                late: mine.filter(x => attState(x).late).length,
                pending: mine.filter(x => x.attendanceStatus === 'PENDING' && x.attendances.length >= 2).length,
                pay: Math.round(hours * hourly(st)),
            };
        }).filter(r => r.st.status === 'ACTIVE' || r.shifts || r.pending).sort((a, b) => a.st.name.localeCompare(b.st.name));
    }

    draw() {
        const s = this.state;
        this.querySelector('[data-month]').textContent = `Tháng ${s.m + 1}/${s.y}`;
        this.querySelector('[data-banner]').innerHTML = HR_MODE === 'spring'
            ? notice('Giờ vào/ra và duyệt công đang bị chặn quyền ở backend (quyền chấm công chưa được seed) nên số giờ làm và lương ước tính chưa có số liệu. Danh sách nhân viên và lương cơ bản đã lấy từ backend.') : '';
        const rows = this.rows();
        const total = rows.reduce((t, r) => t + r.pay, 0);
        this.rowsCache = rows;
        this.querySelector('[data-table]').innerHTML = rows.length ? `
            <ul class="divide-y divide-primary-50 md:hidden">${rows.map(r => `
                <li class="flex items-center justify-between gap-3 p-4">
                    <div class="min-w-0"><p class="truncate font-bold">${esc(r.st.name)}</p>
                        <p class="text-sm font-bold tabular-nums text-primary-700">${fmtMoney(r.pay)}</p></div>
                    <button type="button" data-act="view" data-id="${r.st.id}" title="Xem chi tiết" aria-label="Xem chi tiết ${esc(r.st.name)}"
                        class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-primary-100 text-primary-600 hover:bg-primary-50">${ICONS.eye}</button></li>`).join('')}
                <li class="flex items-center justify-between gap-3 bg-neutral-50 p-4"><span class="font-bold">Tổng chi lương ước tính</span><b class="tabular-nums text-primary-800">${fmtMoney(total)}</b></li></ul>
            <table class="hidden w-full min-w-205 text-sm md:table">
                <thead class="bg-secondary-50"><tr>
                    <th class="${TH}">Nhân viên</th><th class="${TH} text-right">Lương cơ bản</th><th class="${TH} text-center">Số ca</th>
                    <th class="${TH} text-center">Giờ làm</th><th class="${TH} text-center">Đi muộn</th><th class="${TH} text-center">Chờ duyệt</th><th class="${TH} text-right">Ước tính nhận</th>
                </tr></thead>
                <tbody>${rows.map(r => `<tr class="border-t border-primary-50">
                    <th scope="row" class="px-3 py-3 text-left font-bold">${esc(r.st.name)}</th>
                    <td class="px-3 py-3 text-right tabular-nums">${r.st.salary ? fmtMoney(r.st.salary) : '—'}</td>
                    <td class="px-3 py-3 text-center tabular-nums">${r.shifts}</td>
                    <td class="px-3 py-3 text-center tabular-nums">${hrs(r.hours)}</td>
                    <td class="px-3 py-3 text-center tabular-nums ${r.late ? 'font-bold text-red-600' : ''}">${r.late}</td>
                    <td class="px-3 py-3 text-center tabular-nums ${r.pending ? 'font-bold text-amber-700' : ''}">${r.pending}</td>
                    <td class="px-3 py-3 text-right font-bold tabular-nums text-primary-700">${fmtMoney(r.pay)}</td></tr>`).join('')}</tbody>
                <tfoot><tr class="border-t-2 border-primary-100 bg-neutral-50"><th scope="row" colspan="6" class="px-3 py-3 text-right font-bold">Tổng chi lương ước tính</th>
                    <td class="px-3 py-3 text-right text-base font-bold tabular-nums text-primary-800">${fmtMoney(total)}</td></tr></tfoot>
            </table>` : emptyState(this.loading ? 'Đang tải…' : 'Chưa có dữ liệu công', 'Cần có nhân viên, lịch làm và công đã duyệt trong tháng này.');
    }

    onChange(e) {
        const k = e.target.dataset.p;
        if (!k) return;
        const v = Number(e.target.value);
        if (!(v > 0)) { e.target.value = this.state.params[k]; return; }
        this.state.params[k] = v;
        try { localStorage.setItem(PKEY, JSON.stringify(this.state.params)); } catch { /* bỏ qua */ }
        this.draw();
    }

    csv() {
        const q = v => { const t = String(v); return `"${(/^[=+\-@]/.test(t) ? "'" + t : t).replaceAll('"', '""')}"`; };
        const lines = [['Nhân viên', 'Lương cơ bản', 'Số ca', 'Giờ làm', 'Đi muộn', 'Chờ duyệt', 'Ước tính nhận'].map(q).join(',')];
        this.rows().forEach(r => lines.push([r.st.name, r.st.salary, r.shifts, r.hours, r.late, r.pending, r.pay].map(q).join(',')));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
        a.download = `bang-cong-${this.state.y}-${pad(this.state.m + 1)}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    shift(n) { const s = this.state, d = new Date(s.y, s.m + n, 1); s.y = d.getFullYear(); s.m = d.getMonth(); this.reload(); }

    view(r) {
        return openDialog({
            title: 'Chi tiết công', width: 400,
            render: (body, close) => {
                const row = (k, v, cls = '') => `<dt class="font-semibold text-secondary-700">${k}</dt><dd class="text-right font-medium tabular-nums ${cls}">${v}</dd>`;
                body.innerHTML = `
                <p class="mb-3 text-center text-base font-bold">${esc(r.st.name)} · Tháng ${this.state.m + 1}/${this.state.y}</p>
                <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-3 text-sm">
                    ${row('Lương cơ bản', r.st.salary ? fmtMoney(r.st.salary) : '—')}
                    ${row('Số ca', r.shifts)}
                    ${row('Giờ làm', hrs(r.hours))}
                    ${row('Đi muộn', r.late, r.late ? 'font-bold text-red-600' : '')}
                    ${row('Chờ duyệt', r.pending, r.pending ? 'font-bold text-amber-700' : '')}
                    ${row('Ước tính nhận', fmtMoney(r.pay), 'font-bold text-primary-700')}
                </dl>
                <div class="mt-6 flex justify-center"><p-button data-act="close" label="Đóng" class="block w-full md:w-auto"></p-button></div>`;
                bindActions(body, { close: () => close() });
            },
        });
    }

    actions() {
        return {
            prev: () => this.shift(-1), next: () => this.shift(1), csv: () => this.csv(),
            view: el => { const r = this.rowsCache?.find(x => x.st.id === Number(el.dataset.id)); if (r) this.view(r); },
        };
    }
}

customElements.define('hr-payroll', PayrollPanel);
