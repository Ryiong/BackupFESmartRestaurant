import '../../components/PrimaryButton.js';
import { BASE_URL } from '../../config.js';
import { ICONS } from '../../icon.js';
import { bindActions, confirmDialog, toast } from '../../utils/dialog.js';
import { esc, money, hhmm, titleCase, INPUT_CLS } from '../../utils/format.js';
import { ordersApi, ymd, addDays } from '../../services/OrderService.js';

const CARD = 'rounded-2xl bg-white p-5 shadow-sm';
const TH = 'px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-primary-700';
const CHIP = {
    green: 'bg-ok-bg text-ok-fg border-ok-bd', red: 'bg-danger-bg text-danger-fg border-danger-bd', amber: 'bg-warn-bg text-warn-fg border-warn-bd',
    gray: 'bg-neutral-100 text-secondary-800 border-neutral-300', sky: 'bg-info-bg text-info-fg border-info-bd',
};
const chip = (text, tone = 'gray') => `<span class="inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${CHIP[tone]}">${esc(text)}</span>`;

const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const dayLabel = s => { const [y, m, d] = s.split('-').map(Number); return `${WEEKDAY[new Date(y, m - 1, d).getDay()]} (${d}/${m}/${y})`; };
const shortDay = s => { const [y, m, d] = s.split('-').map(Number); return `${d}/${m}/${y}`; };
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const AREA_URL = `${BASE_URL}/admin/area.html`;

/** "35 phút", "2 giờ 5 phút", "3 ngày 4 giờ". */
function duration(ms) {
    const m = Math.max(0, Math.floor(ms / 60000));
    if (m < 60) return `${m} phút`;
    if (m < 1440) return `${Math.floor(m / 60)} giờ ${m % 60} phút`;
    return `${Math.floor(m / 1440)} ngày ${Math.floor((m % 1440) / 60)} giờ`;
}
const emptyState = (title, sub = '') => `<div class="grid place-items-center gap-1 py-14 text-center"><p class="font-bold text-primary-800">${esc(title)}</p>${sub ? `<p class="max-w-sm text-sm text-secondary-700">${esc(sub)}</p>` : ''}</div>`;
const box = (label, v, tone = '') => `<div class="${CARD} p-4!"><p class="text-xs font-bold uppercase text-secondary-700">${label}</p><p class="mt-1 text-2xl font-bold ${tone}">${v}</p></div>`;
const rowKey = o => o.id || `t${o.tableId}`;

class OrderManager extends HTMLElement {
    state = { date: ymd(), filter: 'all', history: [], open: [], loading: true, error: '', expanded: new Set() };
    busy = false;
    seq = 0;

    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.classList.add('block');
        this.innerHTML = `
        <div class="flex flex-col gap-4 pb-6">
            <div class="flex flex-wrap items-center gap-2">
                <button type="button" data-act="prev" aria-label="Ngày trước" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevL}</button>
                <span data-label class="min-w-44 rounded-lg border border-primary-100 bg-white px-4 py-1.5 text-center text-sm font-bold text-primary-800"></span>
                <button type="button" data-act="next" aria-label="Ngày sau" class="grid size-9 cursor-pointer place-items-center rounded-lg border border-primary-100 bg-white text-primary-700 hover:border-primary-500">${ICONS.chevR}</button>
                <p-button data-act="today" label="Hôm nay"></p-button>
                <input type="date" data-pick aria-label="Chọn ngày" class="${INPUT_CLS} w-auto! py-1.5! text-sm">
                <div data-chips class="ml-auto flex flex-wrap gap-1.5" role="group" aria-label="Lọc theo trạng thái"></div>
                <p-button data-act="refresh" label="Làm mới" icon="reload"></p-button>
            </div>
            <div data-sum class="grid grid-cols-2 gap-3 sm:grid-cols-4"></div>
            <div data-note></div>
            <section class="${CARD} p-0! overflow-hidden"><div data-body data-swap class="overflow-x-auto"></div></section>
        </div>`;
        this.q = s => this.querySelector(s);
        bindActions(this, this.actions());
        this.addEventListener('change', e => { if (e.target.matches('[data-pick]') && e.target.value) this.goDate(e.target.value); });

        
        this.timer = setInterval(() => { if (!document.hidden && this.state.date === ymd()) this.load(true); }, 60000);
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

        const [hist, open] = await Promise.allSettled([ordersApi.listByDate(s.date), ordersApi.listOpen()]);
        if (seq !== this.seq) return;
        if (hist.status === 'fulfilled') { s.history = hist.value; s.error = ''; }
        else if (!hist.reason?.noAccess) { s.error = hist.reason?.message || 'Không tải được dữ liệu'; if (silent) toast(s.error); }
        if (open.status === 'fulfilled') s.open = open.value;
        s.loading = false;
        this.draw();
    }

    goDate(date) { this.state.date = date; this.state.history = []; this.load(); }

    rows() {
        const { history, open, date } = this.state;
        const byOrder = new Map(open.filter(e => e.orderId != null).map(e => [String(e.orderId), e]));
        const byTable = new Map(open.filter(e => e.orderId == null).map(e => [String(e.tableId), e]));
        const used = new Set();
        const rows = history.map(h => {
            const e = byOrder.get(h.id) ?? (h.state === 'OPEN' && h.tableId != null ? byTable.get(String(h.tableId)) : null) ?? null;
            if (e) used.add(e);
            return { ...h, entry: e, total: h.total || e?.total || 0 };
        });

        open.filter(e => !used.has(e) && ymd(new Date(e.startedAt ?? Date.now())) === date).forEach(e => rows.unshift({
            id: e.orderId ?? '', state: 'OPEN', rawStatus: '', tableId: e.tableId, tableName: e.tableName, method: null,
            paidAt: null, createdAt: e.startedAt, total: e.total, entry: e,
        }));
        return rows;
    }

    draw() {
        const s = this.state;
        this.q('[data-label]').textContent = dayLabel(s.date);
        this.q('[data-pick]').value = s.date;
        const rows = this.rows();
        this.drawChips(rows);
        this.drawSummary(rows);
        this.drawBody(rows);
    }

    drawChips(rows) {
        const { filter } = this.state;
        const count = v => v === 'all' ? rows.length : rows.filter(o => o.state === v).length;
        const f = (v, label) => `<button type="button" data-act="filter" data-v="${v}" aria-pressed="${filter === v}"
             data-on="${filter === v}" class="sr-toggle sr-pill text-xs">${label} <span class="opacity-70">${count(v)}</span></button>`;
        this.q('[data-chips]').innerHTML = f('all', 'Tất cả') + f('OPEN', 'Chưa thanh toán') + f('PAID', 'Đã thanh toán');
    }

    drawSummary(rows) {
        const { open } = this.state;
        const paid = rows.filter(o => o.state === 'PAID');
        const revenue = paid.reduce((s, o) => s + o.total, 0);
        this.q('[data-sum]').innerHTML = box('Số đơn', rows.length) + box('Đã thanh toán', paid.length, 'text-primary-700')
            + box('Chưa thanh toán', rows.filter(o => o.state === 'OPEN').length, 'text-warn-fg') + box('Doanh thu', money(revenue), 'text-primary-700');

        const today = startOfToday();
        const stale = open.filter(o => o.startedAt && o.startedAt < today);
        const oldest = stale.length ? ymd(new Date(Math.min(...stale.map(o => o.startedAt)))) : '';
         const staleNote = stale.length ? `<div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border-l-4 border-danger-fg bg-danger-bg px-4 py-3 text-sm text-danger-fg" role="alert">
            <p><b>${stale.length} đơn từ ngày trước chưa được thanh toán.</b> Hãy kiểm tra và thanh toán hoặc xử lý để bàn được trả lại.</p>
            ${oldest !== this.state.date ? `<button type="button" data-act="stale" data-v="${esc(oldest)}" class="min-h-11 sr-press cursor-pointer rounded-xl border-2 border-danger-bd bg-white px-3 text-sm font-bold text-danger-fg hover:bg-danger-bg">Xem ngày ${esc(shortDay(oldest))}</button>` : ''}</div>` : '';
        const noTotal = paid.some(o => !o.total)
            ? '<div class="rounded-xl border-l-4 border-warn-ac bg-warn-bg px-4 py-3 text-sm text-warn-fg" role="note">Một số đơn đã thanh toán chưa có tổng tiền vì máy chủ không trả số tiền ở danh sách và đơn đó không được thanh toán trên trình duyệt này.</div>' : '';
        this.q('[data-note]').innerHTML = staleNote || noTotal ? `<div class="flex flex-col gap-3">${staleNote}${noTotal}</div>` : '';
    }

    drawBody(rows = this.rows()) {
        const { filter, loading, error, history, expanded } = this.state;
        const list = rows.filter(o => filter === 'all' || o.state === filter);
        const stateOf = o => o.state === 'PAID' ? ['Đã thanh toán', 'green'] : o.state === 'OPEN' ? ['Chưa thanh toán', 'amber'] : [o.rawStatus || 'Khác', 'gray'];
        const live = o => o.entry ? (o.entry.paying ? chip('Đang thanh toán', 'amber') : chip('Đang phục vụ', 'sky')) : '';
        const where = o => o.entry?.areaName ? `<span class="text-xs font-semibold text-secondary-700">${esc(titleCase(o.entry.areaName))}</span>` : '';
        const since = o => o.entry?.startedAt ? `<p class="text-xs text-secondary-700">đã ${esc(duration(Date.now() - o.entry.startedAt))}</p>` : '';
        const time = o => o.paidAt ? hhmm(o.paidAt) : o.createdAt ? hhmm(o.createdAt) : o.entry?.startedAt ? hhmm(o.entry.startedAt) : '—';
        const items = o => {
            if (!expanded.has(rowKey(o))) return '';
            // Ưu tiên itemResponses từ API (có trạng thái xoá); fallback giỏ local của bàn đang mở
            const its = (o.items?.length ? o.items : o.entry?.items) ?? [];
            if (!its.length) {
                return '<p class="mt-2 rounded-xl bg-neutral-50 p-3 text-sm text-secondary-700">Chưa có thông tin món. Tổng tiền sẽ do hệ thống tính khi thanh toán.</p>';
            }
            return `<ul class="mt-2 space-y-1.5 rounded-xl bg-neutral-50 p-3 text-sm">${its.map(i => {
                const inactive = i.status && String(i.status).toUpperCase() === 'INACTIVE';
                const note = i.note ? `<span class="block text-xs text-secondary-600">Ghi chú: ${esc(i.note)}</span>` : '';
                const who = i.userName ? `<span class="text-xs text-secondary-600"> · ${esc(i.userName)}</span>` : '';
                const deletedMeta = inactive
                    ? `<span class="block text-xs text-danger-fg">Đã xoá${i.deletedBy ? ` bởi ${esc(i.deletedBy)}` : ''}${i.deletedAt ? ` · ${hhmm(i.deletedAt)}` : ''}</span>`
                    : '';
                return `<li class="flex justify-between gap-3 ${inactive ? 'opacity-60' : ''}">
                    <span class="min-w-0 ${inactive ? 'line-through' : ''}">${i.qty} x ${esc(titleCase(i.name))}${who}${note}${deletedMeta}</span>
                    <b class="shrink-0 ${inactive ? 'line-through text-secondary-600' : ''}">${money(i.price * i.qty)}</b>
                </li>`;
            }).join('')}</ul>`;
        };
        const canExpand = o => !!(o.items?.length || o.entry?.items?.length);
        const actions = o => {
            const parts = [];
            if (canExpand(o)) {
                parts.push(`<button type="button" data-act="toggle" data-id="${esc(rowKey(o))}" aria-expanded="${expanded.has(rowKey(o))}" class="min-h-11 sr-press cursor-pointer rounded-xl border-2 border-primary-100 px-3 text-sm font-bold text-primary-700 hover:bg-primary-50">${expanded.has(rowKey(o)) ? 'Ẩn món' : 'Xem món'}</button>`);
            }
            if (o.entry) {
                parts.push(`<a href="${AREA_URL}" class="grid min-h-11 place-items-center rounded-lg border-2 border-primary-100 px-3 text-sm font-bold text-primary-700 hover:bg-primary-50">Mở sơ đồ bàn</a>`);
                parts.push(`<p-button data-act="pay" data-id="${esc(o.entry.tableId)}" label="Thanh toán" icon="check" variant="solid"></p-button>`);
            }
            return parts.length ? `<div class="flex flex-wrap items-center justify-end gap-2">${parts.join('')}</div>` : '';
        };
        const row = o => {
            const [label, tone] = stateOf(o);
            const m = o.method === 'transfer' ? 'Chuyển khoản' : o.method === 'cash' ? 'Tiền mặt' : '—';
            return `<tr class="border-t border-primary-50">
                <td class="px-3 py-3 font-bold">${o.id ? `#${esc(o.id)}` : '—'}</td>
                <td class="px-3 py-3"><p class="font-semibold">${esc(titleCase(o.tableName) || '—')}</p>${where(o)}</td>
                <td class="px-3 py-3"><div class="flex flex-wrap gap-1">${chip(label, tone)}${live(o)}</div></td><td class="px-3 py-3">${m}</td>
                <td class="px-3 py-3 tabular-nums">${time(o)}${since(o)}</td>
                <td class="px-3 py-3 text-right font-bold tabular-nums">${o.total ? money(o.total) : '—'}</td>
                <td class="px-3 py-3">${actions(o)}</td></tr>${expanded.has(rowKey(o)) ? `<tr><td colspan="7" class="px-3 pb-3">${items(o)}</td></tr>` : ''}`;
        };
        const card = o => {
            const [label, tone] = stateOf(o);
            return `<li class="p-4"><div class="flex items-center justify-between gap-3"><div class="min-w-0">
                <p class="font-bold">${o.id ? `#${esc(o.id)} · ` : ''}${esc(titleCase(o.tableName) || '—')} ${where(o)}</p>
                <p class="mt-1 flex flex-wrap gap-1">${chip(label, tone)}${live(o)}</p>
                <p class="mt-1 text-sm text-secondary-700">${time(o)}${o.entry?.startedAt ? ` · đã ${esc(duration(Date.now() - o.entry.startedAt))}` : ''}</p></div>
                <b class="tabular-nums text-primary-700">${o.total ? money(o.total) : '—'}</b></div>
                <div class="mt-3">${actions(o)}</div>${items(o)}</li>`;
        };
        this.q('[data-body]').innerHTML = error ? emptyState('Không tải được danh sách đơn', error)
            : loading && !history.length ? emptyState('Đang tải…')
                : !list.length ? emptyState('Không có đơn nào', rows.length ? 'Thử đổi bộ lọc trạng thái.' : 'Ngày này chưa có đơn hàng.')
                    : `<ul class="sr-stagger divide-y divide-primary-50 md:hidden">${list.map(card).join('')}</ul>
                       <table class="hidden w-full min-w-170 text-sm md:table"><thead class="bg-secondary-50"><tr>
                           <th class="${TH}">Mã đơn</th><th class="${TH}">Bàn</th><th class="${TH}">Trạng thái</th><th class="${TH}">Thanh toán</th>
                           <th class="${TH}">Giờ</th><th class="${TH} text-right">Tổng tiền</th><th class="${TH} text-right">Thao tác</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table>`;
    }

    actions() {
        const s = this.state;
        return {
            refresh: () => this.load(),
            filter: el => { s.filter = el.dataset.v; this.draw(); },
            prev: () => this.goDate(addDays(s.date, -1)),
            next: () => this.goDate(addDays(s.date, 1)),
            today: () => this.goDate(ymd()),
            stale: el => this.goDate(el.dataset.v),
            toggle: el => { const id = el.dataset.id; s.expanded.has(id) ? s.expanded.delete(id) : s.expanded.add(id); this.drawBody(); },
            pay: async el => {
                const o = s.open.find(x => String(x.tableId) === el.dataset.id);
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
                    s.expanded.delete(o.orderId ?? `t${o.tableId}`);
                    await this.load(true);
                } catch (err) { toast(err.message || 'Thanh toán thất bại'); }
                finally { this.busy = false; }
            },
        };
    }
}

customElements.define('order-manager', OrderManager);
