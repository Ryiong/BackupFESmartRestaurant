import '../../components/PrimaryButton.js';
import { requireLogin, logout, http } from '../../services/HttpClient.js';
import { auth } from '../../services/AuthStore.js';
import { ADMIN_URL } from '../../config.js';
import { SHOP_TABS, listShopsByStatus, countShops, approveShop, rejectShop, lockShop, unlockShop } from '../../services/SystemShopService.js';
import { openDialog, bindActions, confirmDialog, toast } from '../../utils/dialog.js';
import { esc, INPUT_CLS } from '../../utils/format.js';
import { ICONS } from '../../icon.js';

const hhmm = t => (t ? String(t).slice(0, 5) : '');
const PAGE = 10;
const TONE = {
    PENDING: 'bg-amber-100 text-amber-800',
    ACTIVE: 'bg-primary-100 text-primary-800',
    LOCKED: 'bg-red-100 text-red-700',
};
const pill = (text, cls) => `<span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}">${esc(text)}</span>`;

/** Trang riêng cho quản trị viên hệ thống: duyệt / từ chối cửa hàng mới, khoá và mở khoá cửa hàng. */
class SystemShops extends HTMLElement {
    async connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        if (!requireLogin()) return;

        this.status = 'PENDING';
        this.page = 0;
        this.q = '';
        this.data = { items: [], total: 0, pages: 1 };
        this.counts = {};

        // Phiên cũ có thể chưa lưu loại tài khoản: hỏi lại máy chủ.
        let type = auth.user?.type;
        if (!type) {
            try { const me = await http('GET', '/auth/me'); type = me?.type; auth.setType(type); } catch { /* xử lý bên dưới */ }
        }
        if (type !== 'ADMIN') return this.forbidden();

        this.className = 'mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-4 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]';
        this.innerHTML = `
            <header class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-xs font-semibold uppercase text-secondary-700">Quản trị hệ thống</p>
                    <p class="truncate text-2xl font-bold leading-tight">Duyệt cửa hàng</p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                    <span class="hidden max-w-40 truncate text-sm font-semibold sm:block">${esc(auth.user?.name || auth.user?.email || '')}</span>
                    <button data-act="logout" class="min-h-11 cursor-pointer rounded-lg border border-primary-200 bg-white px-3 text-sm font-bold text-primary-700 hover:border-primary-500">Đăng xuất</button>
                </div>
            </header>
            <nav data-tabs class="flex gap-2 overflow-x-auto [scrollbar-width:none]" aria-label="Trạng thái cửa hàng"></nav>
            <div class="flex flex-col gap-2 sm:flex-row">
                <label class="relative flex-1">
                    <span class="sr-only">Tìm theo tên, địa chỉ, số điện thoại</span>
                    <input data-q type="search" placeholder="Tìm trong trang này: tên, địa chỉ, số điện thoại…" class="${INPUT_CLS} text-sm">
                </label>
                <p-button data-act="refresh" label="Tải lại" icon="check" class="block sm:inline-block"></p-button>
            </div>
            <p data-error role="alert" class="hidden rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700"></p>
            <section data-list class="grid gap-3 md:grid-cols-2" aria-live="polite"></section>
            <nav data-pager class="flex items-center justify-center gap-3 text-sm font-semibold"></nav>
        `;
        this.addEventListener('input', e => { if (e.target.matches('[data-q]')) { this.q = e.target.value.trim().toLowerCase(); this.renderList(); } });
        bindActions(this, {
            logout: () => logout(),
            refresh: () => this.reload(),
            tab: el => { this.status = el.dataset.status; this.page = 0; this.reload(); },
            prev: () => { this.page = Math.max(0, this.page - 1); this.load(); },
            next: () => { this.page = Math.min(this.data.pages - 1, this.page + 1); this.load(); },
            view: el => this.detail(this.byId(el.dataset.id)),
            approve: el => this.approve(this.byId(el.dataset.id)),
            reject: el => this.askReason(this.byId(el.dataset.id), 'reject'),
            lock: el => this.askReason(this.byId(el.dataset.id), 'lock'),
            unlock: el => this.unlock(this.byId(el.dataset.id)),
        });
        this.reload();
    }

    forbidden() {
        this.className = 'mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center';
        this.innerHTML = `
            <h1 class="text-xl font-bold">Chỉ dành cho quản trị viên hệ thống</h1>
            <p class="text-sm">Tài khoản <b>${esc(auth.user?.email ?? '')}</b> không có quyền truy cập trang này.</p>
            <a href="${ADMIN_URL}" class="inline-flex min-h-11 items-center rounded-lg bg-primary-700 px-4 font-bold text-white">Về trang quản lý cửa hàng</a>
            <button id="out" class="min-h-11 cursor-pointer text-sm font-semibold text-primary-700">Đăng xuất</button>`;
        this.querySelector('#out').addEventListener('click', () => logout());
    }

    byId(id) { return this.data.items.find(s => String(s.id) === String(id)); }

    async reload() { await Promise.all([this.load(), this.loadCounts()]); }

    async loadCounts() {
        this.counts = await countShops();
        this.renderTabs();
    }

    async load() {
        this.loading = true; this.setError('');
        this.renderList();
        try {
            this.data = await listShopsByStatus(this.status, { page: this.page, size: PAGE });
        } catch (e) {
            this.data = { items: [], total: 0, pages: 1 };
            this.setError(/quyền|permission|denied|forbidden/i.test(e.message)
                ? 'Tài khoản này không có quyền quản trị hệ thống trên máy chủ.' : (e.message || 'Không tải được danh sách cửa hàng.'));
        }
        this.loading = false;
        this.renderTabs(); this.renderList(); this.renderPager();
    }

    setError(msg) {
        const el = this.querySelector('[data-error]');
        el.textContent = msg; el.classList.toggle('hidden', !msg);
    }

    renderTabs() {
        this.querySelector('[data-tabs]').innerHTML = SHOP_TABS.map(t => {
            const on = t.status === this.status;
            const n = this.counts[t.status];
            return `<button data-act="tab" data-status="${t.status}" aria-current="${on}" class="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-bold ${on ? 'bg-primary-700 text-white' : 'bg-white text-primary-700 border border-primary-100'}">
                ${t.label}${n == null ? '' : `<span class="rounded-full px-2 text-xs ${on ? 'bg-white/20' : (t.status === 'PENDING' && n ? 'bg-amber-100 text-amber-800' : 'bg-primary-50')}">${n}</span>`}</button>`;
        }).join('');
    }

    renderList() {
        const list = this.querySelector('[data-list]');
        if (this.loading) { list.innerHTML = '<p class="col-span-full p-6 text-center text-sm">Đang tải…</p>'; return; }
        const q = this.q;
        const rows = this.data.items.filter(s => !q || [s.name, s.address, s.phoneNumber].some(v => String(v ?? '').toLowerCase().includes(q)));
        list.innerHTML = rows.length ? rows.map(s => this.card(s)).join('')
            : `<p class="col-span-full rounded-2xl bg-white p-8 text-center text-sm text-secondary-700">${this.status === 'PENDING' ? 'Không có cửa hàng nào đang chờ duyệt.' : 'Không có cửa hàng nào.'}</p>`;
    }

    renderPager() {
        const { pages } = this.data;
        this.querySelector('[data-pager]').innerHTML = pages <= 1 ? '' : `
            <p-button data-act="prev" label="Trước" ${this.page === 0 ? 'disabled' : ''}></p-button>
            <span>Trang ${this.page + 1}/${pages}</span>
            <p-button data-act="next" label="Sau" ${this.page >= pages - 1 ? 'disabled' : ''}></p-button>`;
    }

    card(s) {
        const rejected = this.status === 'PENDING' && s.statusReason;
        const meta = [s.address, s.phoneNumber, s.openTime && s.closeTime ? `${hhmm(s.openTime)} – ${hhmm(s.closeTime)}` : ''].filter(Boolean);
        const actions = {
            PENDING: `<p-button data-act="approve" data-id="${s.id}" label="Duyệt" icon="check" variant="solid"></p-button>
                      <p-button data-act="reject" data-id="${s.id}" label="Từ chối" icon="close" variant="danger"></p-button>`,
            ACTIVE: `<p-button data-act="lock" data-id="${s.id}" label="Khoá cửa hàng" icon="pause" variant="danger"></p-button>`,
            LOCKED: `<p-button data-act="unlock" data-id="${s.id}" label="Mở khoá" icon="check" variant="solid"></p-button>`,
        }[this.status];
        return `<article class="grid gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0"><p class="text-xs font-semibold text-secondary-700">Cửa hàng #${esc(s.id)}</p>
                    <p class="text-base font-bold leading-snug">${esc(s.name)}</p></div>
                <div class="flex shrink-0 items-center gap-2">
                    ${pill(rejected ? 'Đã từ chối' : (SHOP_TABS.find(t => t.status === this.status)?.label ?? ''), rejected ? 'bg-red-100 text-red-700' : TONE[this.status])}
                    <button data-act="view" data-id="${s.id}" title="Xem chi tiết" aria-label="Xem chi tiết ${esc(s.name)}" class="grid size-11 cursor-pointer place-items-center rounded-lg border border-primary-100 text-primary-600 hover:bg-primary-50">${ICONS.eye}</button>
                </div>
            </div>
            ${meta.length ? `<div class="grid gap-0.5 text-sm text-secondary-800">${meta.map(m => `<p>${esc(m)}</p>`).join('')}</div>` : ''}
            ${s.statusReason ? `<p class="rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">Lý do: ${esc(s.statusReason)}</p>` : ''}
            <div class="btn-row">${actions}</div></article>`;
    }

    detail(s) {
        if (!s) return;
        return openDialog({
            title: 'Chi tiết cửa hàng', width: 440,
            render: (body, close) => {
                const row = (k, v) => `<dt class="font-semibold text-secondary-700">${k}</dt><dd class="min-w-0 break-words font-medium">${v || '—'}</dd>`;
                body.innerHTML = `
                    <dl class="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-3 text-sm">
                        ${row('Mã', esc(s.id))}${row('Tên', esc(s.name))}${row('Địa chỉ', esc(s.address))}
                        ${row('Điện thoại', esc(s.phoneNumber))}
                        ${row('Giờ mở cửa', s.openTime && s.closeTime ? `${hhmm(s.openTime)} – ${hhmm(s.closeTime)}` : '')}
                        ${row('Trạng thái', pill(SHOP_TABS.find(t => t.status === (s.status ?? this.status))?.label ?? '', TONE[s.status ?? this.status] ?? ''))}
                        ${s.statusReason ? row('Lý do', esc(s.statusReason)) : ''}
                    </dl>
                    <div class="mt-6 flex justify-center"><p-button data-act="close" label="Đóng" class="block w-full md:w-auto"></p-button></div>`;
                bindActions(body, { close: () => close() });
            },
        });
    }

    async run(fn, okText) {
        try { await fn(); toast(okText, 'success'); }
        catch (e) { toast(e.message || 'Thao tác thất bại'); }
        await this.reload();
    }

    async approve(s) {
        if (!s) return;
        const ok = await confirmDialog({ title: 'Duyệt cửa hàng', message: `Duyệt cửa hàng “${s.name}”? Chủ cửa hàng sẽ dùng được đầy đủ chức năng.`, confirmLabel: 'Duyệt', confirmIcon: 'check' });
        if (ok) this.run(() => approveShop(s.id), 'Đã duyệt cửa hàng');
    }

    async unlock(s) {
        if (!s) return;
        const ok = await confirmDialog({ title: 'Mở khoá cửa hàng', message: `Mở khoá cửa hàng “${s.name}”?`, confirmLabel: 'Mở khoá', confirmIcon: 'check' });
        if (ok) this.run(() => unlockShop(s.id), 'Đã mở khoá cửa hàng');
    }

    /** Từ chối / khoá bắt buộc nhập lý do (chủ cửa hàng sẽ nhìn thấy lý do này). */
    async askReason(s, kind) {
        if (!s) return;
        const cfg = kind === 'reject'
            ? { title: 'Từ chối cửa hàng', label: 'Lý do từ chối', btn: 'Từ chối', fn: rejectShop, ok: 'Đã từ chối cửa hàng' }
            : { title: 'Khoá cửa hàng', label: 'Lý do khoá', btn: 'Khoá', fn: lockShop, ok: 'Đã khoá cửa hàng' };
        const reason = await openDialog({
            title: cfg.title, width: 420,
            render: (body, close) => {
                body.innerHTML = `
                    <form class="grid gap-3" novalidate>
                        <p class="text-sm">Cửa hàng: <b>${esc(s.name)}</b></p>
                        <label class="grid gap-1 text-sm font-semibold">${cfg.label}
                            <textarea name="reason" rows="3" maxlength="500" class="${INPUT_CLS} font-normal" placeholder="Nhập lý do…"></textarea></label>
                        <p data-err role="alert" class="hidden text-sm font-semibold text-red-600">Hãy nhập lý do.</p>
                        <div class="grid gap-3 md:flex md:justify-center">
                            <p-button type="submit" label="${cfg.btn}" variant="danger" class="block md:inline-block"></p-button>
                            <p-button data-act="cancel" label="Huỷ" class="block md:inline-block"></p-button>
                        </div>
                    </form>`;
                const form = body.querySelector('form');
                form.addEventListener('submit', e => {
                    e.preventDefault();
                    const v = form.elements.reason.value.trim();
                    if (!v) { body.querySelector('[data-err]').classList.remove('hidden'); return; }
                    close(v);
                });
                bindActions(body, { cancel: () => close() });
                form.elements.reason.focus();
            },
        });
        if (reason) this.run(() => cfg.fn(s.id, reason), cfg.ok);
    }
}

customElements.define('system-shops', SystemShops);
