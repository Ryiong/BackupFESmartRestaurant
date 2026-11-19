// Trang Quản lý đơn hàng: tab "Đang mở" (đơn chưa thanh toán theo bàn) và tab "Theo ngày" (lịch sử đơn).
import '../../components/PrimaryButton.js';
import { BASE_URL } from '../../config.js';
import { ICONS } from '../../icon.js';
import { bindActions, confirmDialog, toast } from '../../utils/dialog.js';
import { esc, money, hhmm, titleCase, INPUT_CLS } from '../../utils/format.js';
import { ordersApi, ymd, addDays } from '../../services/OrderService.js';

const CARD = 'rounded-2xl bg-white p-5 shadow-sm';
const TH = 'px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-primary-700';
const CHIP = {
    green: 'bg-primary-50 text-primary-800', red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-800',
    gray: 'bg-neutral-100 text-secondary-800', sky: 'bg-sky-100 text-sky-900',
};
const chip = (text, tone = 'gray') => `<span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${CHIP[tone]}">${esc(text)}</span>`;
const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const dayLabel = s => { const [y, m, d] = s.split('-').map(Number); return `${WEEKDAY[new Date(y, m - 1, d).getDay()]} (${d}/${m}/${y})`; };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const AREA_URL = `${BASE_URL}/admin/area.html`;

/** "35 phút", "2 giờ 5 phút", "3 ngày 4 giờ". */
function duration(ms) {
    const m = Math.max(0, Math.floor(ms / 60000));
    if (m < 60) return `${m} phút`;
    if (m < 1440) return `${Math.floor(m / 60)} giờ ${m % 60} phút`;
    return `${Math.floor(m / 1440)} ngày ${Math.floor((m % 1440) / 60)} giờ`;
}
/** Giờ vào: chỉ giờ nếu trong hôm nay, kèm ngày nếu là đơn từ ngày trước. */
const startedLabel = ts => {
    if (!ts) return '—';
    const d = new Date(ts);
    return ts >= startOfToday() ? hhmm(ts) : `${hhmm(ts)} ${d.getDate()}/${d.getMonth() + 1}`;
};
const emptyState = (title, sub = '') => `<div class="grid place-items-center gap-1 py-14 text-center"><p class="font-bold text-primary-800">${esc(title)}</p>${sub ? `<p class="max-w-sm text-sm text-secondary-700">${esc(sub)}</p>` : ''}</div>`;
const box = (label, v, tone = '') => `<div class="${CARD} !p-4"><p class="text-xs font-bold uppercase text-secondary-700">${label}</p><p class="mt-1 text-2xl font-bold ${tone}">${v}</p></div>`;

class OrderManager extends HTMLElement {
    state = { tab: 'open', date: ymd(), filter: 'all', open: [], history: [], loading: true, error: '', expanded: new Set() };
    busy = false;
    seq = 0;

    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.classList.add('block');
        this.innerHTML = `
        <div class="flex flex-col gap-4 pb-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div data-tabs class="flex gap-2" role="tablist" aria-label="Loại đơn"></div>
                <p-button data-act="refresh" label="Làm mới" icon="reload"></p-button>
            </div>
            <div data-toolbar></div>
            <div data-sum class="grid grid-cols-2 gap-3 sm:grid-cols-4"></div>
            <div data-note></div>
            <section class="${CARD} p-0! overflow-hidden"><div data-body class="overflow-x-auto"></div></section>
        </div>`;
        this.q = s => this.querySelector(s);
        bindActions(this, this.actions());
        this.addEventListener('change', e => { if (e.target.matches('[data-pick]') && e.target.value) this.goDate(e.target.value); });
        // Đơn mở là dữ liệu sống: tự làm mới mỗi phút và khi quay lại tab trình duyệt.
        this.timer = setInterval(() => { if (!document.hidden && this.state.tab === 'open') this.load(true); }, 60000);
        this.onVis = () => { if (!document.hidden) this.load(true); };
        document.addEventListener('visibilitychange', this.onVis);
        this.load();
    }

    disconnectedCallback() {
        clearInterval(this.timer);
        document.removeEventListener('visibilitychange', this.onVis);
        delete this.dataset.ready;
    }

    async load(silent = false) {
        const seq = ++this.seq, s = this.state;
        if (!silent) { s.loading = true; s.error = ''; this.draw(); }
        try {
            if (s.tab === 'open') s.open = await ordersApi.listOpen();
            else s.history = await ordersApi.listByDate(s.date);
            s.error = '';
        } catch (err) {
            if (seq !== this.seq) return;
            if (!err.noAccess) { s.error = err.message || 'Không tải được dữ liệu'; if (silent) toast(s.error); }
        }
        if (seq !== this.seq) return; // đổi tab/ngày nhanh: bỏ kết quả cũ
        s.loading = false;
        this.draw();
    }

    goDate(date) { this.state.date = date; this.state.history = []; this.load(); }

    draw() {
        this.drawTabs();
        this.drawToolbar();
        this.state.tab === 'open' ? this.drawOpen() : this.drawHistory();
    }

    drawTabs() {
        const { tab, open } = this.state;
        const t = (k, label, extra = '') => `<button type="button" role="tab" data-act="tab" data-v="${k}" aria-selected="${tab === k}"
            class="min-h-11 cursor-pointer rounded-xl px-4 text-sm font-bold transition-all ${tab === k ? 'bg-primary-700 text-white' : 'bg-white text-primary-700 hover:bg-primary-50'}">${label}${extra}</button>`;
        this.q('[data-tabs]').innerHTML = t('open', 'Đang mở', tab === 'open' && !this.state.loading ? ` <span class="opacity-70">${open.length}</span>` : '') + t('history', 'Theo ngày');
    }

    drawToolbar() {
        const { tab, date, filter } = this.state;
        if (tab === 'open') { this.q('[data-toolbar]').innerHTML = ''; return; }
        const f = (v, label) => `<button type="button" data-act="filter" data-v="${v}" aria-pressed="${filter === v}"
            class="cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition-all hover:scale-95 ${filter === v ? 'border-primary-700 bg-primary-700 text-white' : 'border-primary-200 bg-white text-primary-700'}">${label}</button>`;
        this.q('[data-toolbar]').innerHTML = `
        <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-act="prev" aria-label="Ngày trước" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevL}</button>
            <span class="min-w-44 rounded-lg border border-primary-100 bg-white px-4 py-1.5 text-center text-sm font-bold text-primary-800">${esc(dayLabel(date))}</span>
            <button type="button" data-act="next" aria-label="Ngày sau" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevR}</button>
            <p-button data-act="today" label="Hôm nay"></p-button>
            <input type="date" data-pick value="${esc(date)}" aria-label="Chọn ngày" class="${INPUT_CLS} !w-auto !py-1.5 text-sm">
            <div class="ml-auto flex flex-wrap gap-1.5">${f('all', 'Tất cả')}${f('OPEN', 'Chưa thanh toán')}${f('PAID', 'Đã thanh toán')}</div>
        </div>`;
    }

    /* ---------- Tab "Đang mở" ---------- */
    drawOpen() {
        const { open, loading, error, expanded } = this.state;
        const today = startOfToday();
        const stale = open.filter(o => o.startedAt && o.startedAt < today);
        const total = open.reduce((s, o) => s + o.total, 0);
        this.q('[data-sum]').innerHTML = box('Bàn có đơn mở', open.length) + box('Tạm tính', money(total), 'text-primary-700')
            + box('Đơn từ ngày trước', stale.length, stale.length ? 'text-red-600' : '') + box('Đang thanh toán', open.filter(o => o.paying).length, 'text-amber-700');
        this.q('[data-note]').innerHTML = stale.length ? `<div class="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><b>${stale.length} đơn từ ngày trước chưa được thanh toán.</b> Hãy kiểm tra và thanh toán hoặc xử lý để bàn được trả lại.</div>` : '';
        this.q('[data-body]').innerHTML = error ? emptyState('Không tải được đơn đang mở', error)
            : loading && !open.length ? emptyState('Đang tải…')
                : !open.length ? emptyState('Không có đơn nào đang mở', 'Mọi bàn đều trống hoặc đã thanh toán.')
                    : `<ul class="divide-y divide-primary-50">${open.map(o => this.openRow(o, today, expanded.has(o.tableId))).join('')}</ul>`;
    }

    openRow(o, today, expanded) {
        const old = o.startedAt && o.startedAt < today;
        const count = o.items.reduce((s, i) => s + i.qty, 0);
        const items = expanded ? (o.items.length
            ? `<ul class="mt-2 space-y-1 rounded-xl bg-neutral-50 p-3 text-sm">${o.items.map(i => `<li class="flex justify-between gap-3"><span>${i.qty} x ${esc(titleCase(i.name))}</span><b>${money(i.price * i.qty)}</b></li>`).join('')}</ul>`
            : '<p class="mt-2 rounded-xl bg-neutral-50 p-3 text-sm text-secondary-700">Chưa có thông tin món. Tổng tiền sẽ do hệ thống tính khi thanh toán.</p>') : '';
        return `<li class="p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="flex flex-wrap items-center gap-2 font-bold"><span class="text-primary-700">${esc(titleCase(o.tableName))}</span>
                        <span class="text-xs font-semibold text-secondary-700">${esc(titleCase(o.areaName))}</span>
                        ${o.paying ? chip('Đang thanh toán', 'amber') : chip('Đang phục vụ', 'sky')}${old ? chip('Từ ngày trước', 'red') : ''}</p>
                    <p class="mt-1 text-sm text-secondary-700">Vào lúc <b class="text-text">${startedLabel(o.startedAt)}</b> · đã ${esc(o.startedAt ? duration(Date.now() - o.startedAt) : '—')} · ${count ? `${count} món` : 'chưa rõ số món'}${o.orderId ? ` · Đơn #${esc(o.orderId)}` : ''}</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <b class="text-lg text-primary-700">${o.total ? money(o.total) : '—'}</b>
                    <button type="button" data-act="toggle" data-id="${esc(o.tableId)}" aria-expanded="${expanded}" class="min-h-11 cursor-pointer rounded-lg border-2 border-primary-100 px-3 text-sm font-bold text-primary-700 hover:bg-primary-50">${expanded ? 'Ẩn món' : 'Xem món'}</button>
                    <a href="${AREA_URL}" class="grid min-h-11 place-items-center rounded-lg border-2 border-primary-100 px-3 text-sm font-bold text-primary-700 hover:bg-primary-50">Mở sơ đồ bàn</a>
                    <p-button data-act="pay" data-id="${esc(o.tableId)}" label="Thanh toán" icon="check" variant="solid"></p-button>
                </div>
            </div>${items}</li>`;
    }

    /* ---------- Tab "Theo ngày" ---------- */
    drawHistory() {
        const { history, filter, loading, error } = this.state;
        const paid = history.filter(o => o.state === 'PAID');
        const revenue = paid.reduce((s, o) => s + o.total, 0);
        const list = history.filter(o => filter === 'all' || o.state === filter);
        this.q('[data-sum]').innerHTML = box('Số đơn', history.length) + box('Đã thanh toán', paid.length, 'text-primary-700')
            + box('Chưa thanh toán', history.filter(o => o.state === 'OPEN').length, 'text-amber-700') + box('Doanh thu', money(revenue), 'text-primary-700');
        this.q('[data-note]').innerHTML = paid.some(o => !o.total)
            ? '<div class="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Một số đơn đã thanh toán chưa có tổng tiền vì máy chủ không trả số tiền ở danh sách và đơn đó không được thanh toán trên trình duyệt này.</div>' : '';
        const row = o => {
            const tone = o.state === 'PAID' ? 'green' : o.state === 'OPEN' ? 'amber' : 'gray';
            const label = o.state === 'PAID' ? 'Đã thanh toán' : o.state === 'OPEN' ? 'Chưa thanh toán' : (o.rawStatus || 'Khác');
            const m = o.method === 'transfer' ? 'Chuyển khoản' : o.method === 'cash' ? 'Tiền mặt' : '—';
            return `<tr class="border-t border-primary-50">
                <td class="px-3 py-3 font-bold">#${esc(o.id)}</td><td class="px-3 py-3">${esc(titleCase(o.tableName) || '—')}</td>
                <td class="px-3 py-3">${chip(label, tone)}</td><td class="px-3 py-3">${m}</td>
                <td class="px-3 py-3 tabular-nums">${o.paidAt ? hhmm(o.paidAt) : o.createdAt ? hhmm(o.createdAt) : '—'}</td>
                <td class="px-3 py-3 text-right font-bold tabular-nums">${o.total ? money(o.total) : '—'}</td></tr>`;
        };
        const card = o => `<li class="flex items-center justify-between gap-3 p-4"><div><p class="font-bold">#${esc(o.id)} · ${esc(titleCase(o.tableName) || '—')}</p>
            <p class="mt-1">${o.state === 'PAID' ? chip('Đã thanh toán', 'green') : o.state === 'OPEN' ? chip('Chưa thanh toán', 'amber') : chip(o.rawStatus || 'Khác')}</p></div>
            <b class="tabular-nums text-primary-700">${o.total ? money(o.total) : '—'}</b></li>`;
        this.q('[data-body]').innerHTML = error ? emptyState('Không tải được danh sách đơn', error)
            : loading && !history.length ? emptyState('Đang tải…')
                : !list.length ? emptyState('Không có đơn nào', history.length ? 'Thử đổi bộ lọc trạng thái.' : 'Ngày này chưa có đơn hàng.')
                    : `<ul class="divide-y divide-primary-50 md:hidden">${list.map(card).join('')}</ul>
                       <table class="hidden w-full min-w-170 text-sm md:table"><thead class="bg-secondary-50"><tr>
                           <th class="${TH}">Mã đơn</th><th class="${TH}">Bàn</th><th class="${TH}">Trạng thái</th><th class="${TH}">Thanh toán</th>
                           <th class="${TH}">Giờ</th><th class="${TH} text-right">Tổng tiền</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table>`;
    }

    actions() {
        const s = this.state;
        return {
            tab: el => { if (s.tab !== el.dataset.v) { s.tab = el.dataset.v; this.load(); } },
            refresh: () => this.load(),
            filter: el => { s.filter = el.dataset.v; this.draw(); },
            prev: () => this.goDate(addDays(s.date, -1)),
            next: () => this.goDate(addDays(s.date, 1)),
            today: () => this.goDate(ymd()),
            toggle: el => { const id = el.dataset.id; s.expanded.has(id) ? s.expanded.delete(id) : s.expanded.add(id); this.drawOpen(); },
            pay: async el => {
                const o = s.open.find(x => x.tableId === el.dataset.id);
                if (!o || this.busy) return;
                const name = titleCase(o.tableName);
                const ok = await confirmDialog({
                    title: 'Thanh toán đơn',
                    message: o.total ? `Xác nhận đã nhận ${money(o.total)} cho ${name}? Bàn sẽ được trả về trạng thái trống.` : `Xác nhận thanh toán đơn của ${name}? Tổng tiền do hệ thống tính. Bàn sẽ được trả về trạng thái trống.`,
                    confirmLabel: 'Thanh toán',
                });
                if (!ok) return;
                this.busy = true;
                try {
                    const r = await ordersApi.pay(o.tableId, o.total);
                    toast(`Đã thanh toán ${money(r.total)} — ${name}`, 'success');
                    s.expanded.delete(o.tableId);
                    await this.load(true);
                } catch (err) { toast(err.message || 'Thanh toán thất bại'); }
                finally { this.busy = false; }
            },
        };
    }
}

customElements.define('order-manager', OrderManager);
