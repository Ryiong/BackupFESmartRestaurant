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

            ${this.notice ? `<p role="status" class="rounded-xl p-3 text-sm font-semibold ${this.notice.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}">${esc(this.notice.text)}</p>` : ''}

            ${this.pending ? this.confirmCard(open) : ''}

            <section class="rounded-2xl border border-primary-100 bg-white p-4">
                <h2 class="mb-2 text-sm font-bold">Ca làm hôm nay</h2>
                ${this.shopId ? this.shiftList(now) : '<p class="text-sm text-secondary-700">Quét mã QR chấm công tại quán để bắt đầu.</p>'}
            </section>

            <button data-act="scan" class="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary-700 text-base font-bold text-white shadow hover:bg-primary-800">Quét QR chấm công</button>
            <button data-act="loginqr" class="min-h-11 cursor-pointer text-sm font-semibold text-primary-600">Đăng nhập trên thiết bị khác (tạo QR)</button>
        `;
        this.bind();
        if (this.pending) this.renderExp();
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
                <span class="text-xs font-bold text-primary-700">${state}</span></li>`;
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
            if (act === 'submit') return this.submit(Number(el.dataset.id));
        };
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
