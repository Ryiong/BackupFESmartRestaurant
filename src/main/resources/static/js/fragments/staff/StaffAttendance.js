import '../../components/PrimaryButton.js';
import { requireLogin, logout } from '../../services/HttpClient.js';
import { auth } from '../../services/AuthStore.js';
import { esc } from '../../utils/format.js';
import {
    parseAttendanceQr, listMyShifts, eligibleShifts, getPosition, checkAttendance,
} from '../../services/AttendanceService.js';

const SHOP_KEY = 'sr:staffShop';
const store = {
    get: () => { try { return Number(localStorage.getItem(SHOP_KEY)) || null; } catch { return null; } },
    set: v => { try { localStorage.setItem(SHOP_KEY, String(v)); } catch { /* bỏ qua */ } },
};
const LAST_KEY = 'sr:lastCheck';
const lastStore = {
    get: () => { try { return JSON.parse(localStorage.getItem(LAST_KEY) ?? 'null'); } catch { return null; } },
    set: v => { try { localStorage.setItem(LAST_KEY, JSON.stringify(v)); } catch { /* bỏ qua */ } },
};
const fmtTime = ms => new Date(ms).toLocaleTimeString('vi-VN');
const fmtDate = ms => new Date(ms).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
const TYPE_LABEL = { CHECK_IN: 'Vào ca', CHECK_OUT: 'Ra ca' };
const hhmm = d => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

class StaffAttendance extends HTMLElement {
    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        if (!requireLogin()) return;

        this.shopId = store.get();
        this.pending = null; // { shopId, exp } đã quét, chờ xác nhận
        this.shifts = [];
        this.notice = null;  // { ok, text }
        this.result = null;  // kết quả chấm công vừa xong { type, at, shift }
        this.last = lastStore.get();

        // Mở thẳng từ QR (camera hệ điều hành): ?shop=&exp=
        const qs = location.search;
        if (qs.includes('shop=')) {
            try {
                this.pending = parseAttendanceQr(location.href);
                this.shopId = this.pending.shopId;
            } catch (e) { this.notice = { ok: false, text: e.message }; }
            history.replaceState(null, '', location.pathname);
        }

        this.render();
        setInterval(() => this.tick(), 1000);
        if (this.shopId) this.load();
    }

    async load() {
        this.loading = true; this.loadError = '';
        this.render();
        try { this.shifts = await listMyShifts(this.shopId); }
        catch (e) { this.loadError = e.message; this.shifts = []; }
        this.loading = false;
        this.render();
    }

    tick() {
        const c = this.querySelector('[data-clock]');
        if (c) c.textContent = new Date().toLocaleTimeString('vi-VN');
        if (this.pending && this.querySelector('[data-exp]')) this.renderExp();
    }

    renderExp() {
        const left = Math.round((new Date(this.pending.exp) - Date.now()) / 1000);
        const el = this.querySelector('[data-exp]');
        if (el) el.textContent = left > 0 ? `Mã QR còn hiệu lực ${left} giây` : 'Mã QR đã hết hạn, hãy quét lại.';
    }

    render() {
        const name = auth.user?.name || auth.user?.email || '';
        const now = Date.now();
        const open = eligibleShifts(this.shifts, now);
        this.className = 'mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]';
        this.innerHTML = `
            <header class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-xs font-semibold uppercase text-secondary-700">Chấm công</p>
                    <p class="truncate font-bold">${esc(name)}</p>
                </div>
                <button data-act="logout" class="min-h-11 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-bold text-primary-600">Đăng xuất</button>
            </header>

            <section class="rounded-2xl bg-primary-700 p-5 text-center text-white shadow">
                <p data-clock class="text-4xl font-bold tabular-nums">${new Date().toLocaleTimeString('vi-VN')}</p>
                <p class="mt-1 text-sm opacity-90">${new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
            </section>

            ${this.resultCard()}

            ${this.notice ? `<p role="status" class="rounded-xl p-3 text-sm font-semibold ${this.notice.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}">${esc(this.notice.text)}</p>` : ''}

            ${this.pending ? this.confirmCard(open) : ''}
            ${this.pending ? this.checklist(open) : ''}

            <section class="rounded-2xl border border-primary-100 bg-white p-4">
                <h2 class="mb-2 text-sm font-bold">Ca làm hôm nay</h2>
                ${this.shopId ? this.shiftList(now) : '<p class="text-sm text-secondary-700">Quét mã QR chấm công tại quán để bắt đầu.</p>'}
            </section>

            <details class="rounded-xl border border-primary-100 bg-white p-3 text-sm">
                <summary class="cursor-pointer font-semibold text-primary-700">Không quét được? Dán link QR</summary>
                <div class="mt-2 grid gap-2">
                    <input data-link type="url" inputmode="url" placeholder="https://…/staff/attendance.html?shop=…" class="w-full rounded-lg border border-primary-200 px-3 py-2">
                    <button data-act="paste" class="min-h-11 cursor-pointer rounded-lg border-2 border-primary-100 font-bold text-primary-600">Dùng link này</button>
                </div>
            </details>
            <button data-act="scan" class="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary-700 text-base font-bold text-white shadow hover:bg-primary-800">Quét QR chấm công</button>
            <button data-act="loginqr" class="min-h-11 cursor-pointer text-sm font-semibold text-primary-600">Đăng nhập trên thiết bị khác (tạo QR)</button>
        `;
        this.bind();
        if (this.pending) this.renderExp();
    }

    resultCard() {
        const r = this.result ?? (this.last && this.last.day === new Date().toDateString() ? { ...this.last, old: true } : null);
        if (!r) return '';
        const out = r.type === 'CHECK_OUT';
        return `<section role="status" class="rounded-2xl border-2 ${out ? 'border-sky-500 bg-sky-50' : 'border-green-600 bg-green-50'} p-4 text-center">
            <p class="text-xs font-bold uppercase text-secondary-700">${r.old ? 'Lần chấm công gần nhất' : 'Chấm công thành công'}</p>
            <p class="mt-1 text-xl font-bold">${TYPE_LABEL[r.type] ?? 'Chấm công'}</p>
            <p class="text-3xl font-bold tabular-nums">${fmtTime(r.at)}</p>
            <p class="text-sm">${fmtDate(r.at)}</p>
            ${r.shift ? `<p class="mt-1 text-sm font-semibold">${esc(r.shift)}</p>` : ''}</section>`;
    }

    checklist(open) {
        const row = (ok, text) => `<li class="flex gap-2"><span class="${ok === false ? 'text-red-600' : ok ? 'text-green-700' : 'text-amber-600'} font-bold">${ok === false ? '✗' : ok ? '✓' : '…'}</span><span>${text}</span></li>`;
        const expired = new Date(this.pending.exp) <= Date.now();
        const u = auth.user;
        return `<section class="rounded-2xl border border-primary-100 bg-white p-4 text-sm">
            <h2 class="mb-2 font-bold">Kiểm tra trước khi chấm công</h2>
            <ul class="grid gap-1.5">
                ${row(true, `Đã đăng nhập: <b>${esc(u?.name || u?.email || '')}</b>${u?.type ? ` (${esc(u.type)})` : ''}`)}
                ${row(!expired, `Mã QR cửa hàng #${esc(this.pending.shopId)}: ${expired ? 'đã hết hạn, hãy quét lại' : 'còn hiệu lực'}`)}
                ${this.loading ? row(null, 'Đang tải ca làm…') : this.loadError ? row(false, esc(this.loadError))
                    : row(open.length > 0, open.length ? `Có ${open.length} ca trong khung giờ chấm công` : (this.shifts.length ? 'Có ca hôm nay nhưng chưa tới (hoặc đã quá) khung giờ chấm công' : `Không tìm thấy ca nào của <b>${esc(u?.email ?? '')}</b> hôm nay${u?.type && u.type !== 'STAFF' ? ' — hãy đăng nhập bằng tài khoản nhân viên được xếp ca' : ''}`))}
                ${row(null, 'Vị trí: sẽ xin khi bạn bấm chấm công (cần bật GPS)')}
            </ul></section>`;
    }

    shiftList(now) {
        if (this.loading) return '<p class="text-sm">Đang tải…</p>';
        if (this.loadError) return `<p class="text-sm font-semibold text-red-700">${esc(this.loadError)}</p>`;
        if (!this.shifts.length) return '<p class="text-sm text-secondary-700">Bạn không có ca nào hôm nay.</p>';
        return `<ul class="grid gap-2">${this.shifts.map(s => {
            const state = s.attendances.length >= 2 ? 'Đã xong'
                : s.attendances.length === 1 ? 'Đã vào ca'
                    : now < s.opens ? 'Chưa đến giờ' : now > s.closes ? 'Đã qua giờ' : 'Có thể chấm công';
            return `<li class="flex items-center justify-between gap-2 rounded-xl bg-primary-50/60 p-3">
                <div><p class="font-semibold">${esc(s.shiftName)}</p><p class="text-sm tabular-nums text-secondary-700">${esc(s.startTime)} – ${esc(s.endTime)}</p></div>
                <div class="text-right"><span class="text-xs font-bold text-primary-700">${state}</span>
                ${s.attendances.length ? `<p class="mt-0.5 text-xs tabular-nums text-secondary-700">${s.attendances.map(a => `${a.type === 'CHECK_OUT' ? 'Ra' : 'Vào'} ${esc(String(a.at ?? '').slice(11, 16) || '—')}`).join(' · ')}</p>` : ''}</div></li>`;
        }).join('')}</ul>`;
    }

    confirmCard(open) {
        const expired = new Date(this.pending.exp) <= Date.now();
        let body;
        if (this.loading) body = '<p class="text-sm">Đang kiểm tra ca làm…</p>';
        else if (!open.length) body = '<p class="text-sm font-semibold text-red-700">Hiện không có ca nào trong khung giờ chấm công (từ 30 phút trước đến 30 phút sau ca).</p>';
        else body = open.map(s => `
            <button data-act="submit" data-id="${s.id}" ${expired || this.busy ? 'disabled' : ''} class="min-h-14 w-full cursor-pointer rounded-xl bg-primary-700 px-4 text-left font-bold text-white disabled:opacity-50">
                Chấm công: ${esc(s.shiftName)} <span class="font-normal tabular-nums">(${esc(s.startTime)} – ${esc(s.endTime)})</span>
            </button>`).join('<div class="h-2"></div>');
        return `<section class="rounded-2xl border-2 border-primary-600 bg-white p-4">
            <h2 class="mb-1 text-sm font-bold">Xác nhận chấm công</h2>
            <p data-exp class="mb-3 text-xs text-secondary-700"></p>${body}</section>`;
    }

    bind() {
        this.onclick = async e => {
            const el = e.target.closest('[data-act]');
            if (!el || el.disabled) return;
            const act = el.dataset.act;
            if (act === 'logout') return logout();
            if (act === 'loginqr') return (await import('../auth/LoginQrDialog.js')).loginQrDialog();
            if (act === 'scan') return this.scan();
            if (act === 'paste') return this.usePasted();
            if (act === 'submit') return this.submit(Number(el.dataset.id));
        };
    }

    async usePasted() {
        const v = this.querySelector('[data-link]')?.value ?? '';
        try {
            const res = parseAttendanceQr(v);
            this.pending = res; this.notice = null; this.shopId = res.shopId;
            await this.load();
        } catch (e) { this.notice = { ok: false, text: e.message }; this.render(); }
    }

    async scan() {
        const { scanQrDialog } = await import('../../utils/qrScanDialog.js');
        const res = await scanQrDialog({
            title: 'Quét QR chấm công',
            hint: 'Quét mã QR đang hiện tại quán.',
            accept: parseAttendanceQr,
        });
        if (!res) return;
        this.pending = res; this.notice = null;
        const changed = res.shopId !== this.shopId;
        this.shopId = res.shopId;
        if (changed || !this.shifts.length) await this.load(); else this.render();
    }

    async submit(workScheduleId) {
        if (this.busy || !this.pending) return;
        if (new Date(this.pending.exp) <= Date.now()) { this.notice = { ok: false, text: 'Mã QR đã hết hạn, hãy quét lại.' }; return this.render(); }
        this.busy = true; this.notice = { ok: true, text: 'Đang lấy vị trí và chấm công…' }; this.render();
        try {
            const pos = await getPosition();
            const res = await checkAttendance({
                shopId: this.pending.shopId, workScheduleId, qrExpiredAt: this.pending.exp, ...pos,
            });
            store.set(this.pending.shopId);
            const label = TYPE_LABEL[res?.type] ?? 'Chấm công';
            const shift = this.shifts.find(s => s.id === workScheduleId);
            const at = Date.now();
            this.result = { type: res?.type, at, shift: shift ? `${shift.shiftName} (${shift.startTime} – ${shift.endTime})` : '' };
            lastStore.set({ ...this.result, day: new Date().toDateString() });
            this.notice = { ok: true, text: `${label} thành công lúc ${hhmm(new Date())}.` };
            this.pending = null;
            this.busy = false;
            await this.load();
        } catch (err) {
            this.notice = { ok: false, text: err.message || 'Chấm công thất bại.' };
            this.busy = false; this.render();
        }
    }
}

customElements.define('staff-attendance', StaffAttendance);
