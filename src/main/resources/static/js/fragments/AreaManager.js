import '../components/PrimaryButton.js';
import '../components/LabelButton.js';
import '../components/TableCard.js';
import { areaService } from '../services/AreaService.js';
import { bindActions, confirmDialog, toast } from '../utils/dialog.js';
import { esc, money, orderTotal, effectiveCapacity, titleCase } from '../utils/format.js';
import { detailHtml, emptyDetailHtml } from './AreaTemplates.js';
import { areaEditorDialog, guestsDialog, orderDialog, pickTableDialog } from './AreaDialogs.js';

const FILTERS = [
    { v: 'all', label: 'Tất cả', match: () => true },
    { v: 'empty', label: 'Trống', match: t => t.status === 'empty' },
    { v: 'busy', label: 'Đang dùng', match: t => ['serving', 'paying', 'merged'].includes(t.status) }
];

class AreaManager extends HTMLElement {
    state = { areas: [], areaId: null, tableId: null, filter: 'all', pay: { method: 'cash', received: 0 }, loading: true };
    busy = false;
    menu = null;

    get area() { return this.state.areas.find(a => a.id === this.state.areaId) ?? null; }
    get table() { return this.area?.tables.find(t => t.id === this.state.tableId) ?? null; }

    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.build();
        bindActions(this, this.actions(), { capture: true });
        this.addEventListener('input', e => this.onInput(e));
        this.timer = setInterval(() => { if (this.table?.status === 'serving') this.renderDetail(); }, 30000);
        this.refresh();
    }

    disconnectedCallback() { clearInterval(this.timer); }

    build() {
        this.innerHTML = `
        <div class="flex flex-col gap-4 pb-6">
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div data-tabs class="flex min-w-0 flex-1 flex-wrap gap-2" role="tablist" aria-label="Khu vực"></div>
                <div class="flex flex-wrap gap-2.5">
                    <p-button data-act="edit-area" label="Chỉnh sửa khu vực" icon="edit"></p-button>
                    <p-button data-act="delete-area" label="Xoá khu vực" icon="delete" variant="danger"></p-button>
                    <p-button data-act="add-area" label="Thêm khu vực" icon="add" variant="solid"></p-button>
                </div>
            </div>
            <div class="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section class="min-h-112 rounded-2xl bg-white p-5 shadow-sm" aria-label="Sơ đồ bàn">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                        <h2 class="text-lg font-bold">Sơ đồ bàn</h2>
                        <div data-filters class="flex flex-wrap gap-1.5"></div>
                    </div>
                    <div data-grid class="mt-4 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4"></div>
                </section>
                <aside data-detail class="rounded-2xl bg-white p-5 shadow-sm xl:sticky xl:top-4" aria-live="polite"></aside>
            </div>
        </div>`;
        this.el = {
            tabs: this.querySelector('[data-tabs]'),
            filters: this.querySelector('[data-filters]'),
            grid: this.querySelector('[data-grid]'),
            detail: this.querySelector('[data-detail]'),
            edit: this.querySelector('[data-act="edit-area"]'),
            del: this.querySelector('[data-act="delete-area"]'),
        };
    }

    async refresh(patch = {}) {
        try {
            const areas = await areaService.listAreas();
            Object.assign(this.state, patch, { areas, loading: false });
            const s = this.state;
            if (!this.area || !this.area.active) s.areaId = areas.find(a => a.active)?.id ?? null;
            if (!this.table) s.tableId = null;
        } catch (err) {
            this.state.loading = false;
            toast(err.message || 'Không tải được dữ liệu');
        }
        this.renderAll();
    }

    async run(fn, successMsg, patch) {
        if (this.busy) return undefined;
        this.busy = true;
        try {
            const result = await fn();
            await this.refresh(patch);
            if (successMsg) toast(typeof successMsg === 'function' ? successMsg(result) : successMsg, 'success');
            return result;
        } catch (err) {
            toast(err.message || 'Có lỗi xảy ra');
            return undefined;
        } finally { this.busy = false; }
    }

    renderAll() {
        this.renderTabs(); 
        this.renderToolbar(); 
        this.renderFilters(); 
        this.renderGrid(); 
        this.renderDetail(); 
    }

    renderTabs() {
        const { areas, areaId, loading } = this.state;
        if (loading) { this.el.tabs.innerHTML = '<span class="text-sm text-secondary-700">Đang tải…</span>'; return; }
        this.el.tabs.innerHTML = areas.length ? areas.map(a => a.active
            ? `<span role="tab" aria-selected="${a.id === areaId}"><l-button data-act="select-area" data-id="${esc(a.id)}" label="${esc(a.name).toLocaleUpperCase()}" variant="${a.id === areaId ? 'primary' : 'solid'}"></l-button></span>`
            : `<span role="tab" aria-selected="false" data-act="reactivate" data-id="${esc(a.id)}" title="Khu vực đang tạm ngưng — bấm để kích hoạt lại"
                class="cursor-pointer [&_button]:pointer-events-none"><l-button label="${esc(a.name).toLocaleUpperCase()}" disabled></l-button></span>`).join('')
            : '<span class="text-sm text-secondary-700">Chưa có khu vực nào. Nhấn “Thêm khu vực” để bắt đầu.</span>';
    }

    renderToolbar() {
        const none = !this.area;
        this.el.edit.toggleAttribute('disabled', none);
        this.el.del.toggleAttribute('disabled', none);
    }

    renderFilters() {
        const tables = this.area?.tables ?? [];
        this.el.filters.hidden = !tables.length;
        this.el.filters.innerHTML = FILTERS.map(f => {
            const on = this.state.filter === f.v;
            return `<button type="button" data-act="filter" data-v="${f.v}" aria-pressed="${on}"
                class="cursor-pointer rounded-full border px-3 py-1 text-xs font-bold transition-all hover:scale-95 ${on ? 'border-primary-700 bg-primary-700 text-white' : 'border-primary-200 bg-white text-primary-700'}">
                ${f.label} <span class="opacity-70">${tables.filter(f.match).length}</span></button>`;
        }).join('');
    }

    renderGrid() {
        const area = this.area;
        if (!area) { this.el.grid.innerHTML = '<p class="col-span-full py-16 text-center text-sm text-secondary-700">Chọn hoặc thêm một khu vực để xem sơ đồ bàn.</p>'; return; }
        const match = FILTERS.find(f => f.v === this.state.filter).match;
        const list = area.tables.filter(match);
        if (!area.tables.length) { this.el.grid.innerHTML = '<p class="col-span-full py-16 text-center text-sm text-secondary-700">Khu vực chưa có bàn. Dùng “Chỉnh sửa khu vực” để thêm bàn.</p>'; return; }
        if (!list.length) { this.el.grid.innerHTML = '<p class="col-span-full py-16 text-center text-sm text-secondary-700">Không có bàn nào ở trạng thái này.</p>'; return; }
        this.el.grid.innerHTML = list.map(t => {
            const primary = t.status === 'merged' ? area.tables.find(x => x.id === t.mergedInto) : null;
            return `<table-card data-act="select-table" data-id="${esc(t.id)}" name="${esc(t.name).toLocaleUpperCase()}" capacity="${effectiveCapacity(t, area.tables)}"
                status="${t.status}" variant="view" ${primary ? `note="Gộp vào ${esc(primary.name).toLocaleUpperCase()}"` : ''}
                ${t.id === this.state.tableId ? 'selected' : ''}></table-card>`;
        }).join('');
    }

    renderDetail() {
        const { area, table } = this;
        this.el.detail.innerHTML = area && table
            ? detailHtml({ table, area, pay: this.state.pay })
            : emptyDetailHtml(Boolean(area));
    }

    onInput(e) {
        if (e.target.dataset?.f !== 'received') return;
        const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
        const received = Number(digits || 0);
        this.state.pay.received = received;
        e.target.value = received ? received.toLocaleString('vi-VN') : '';
        this.syncPayment();
    }

    syncPayment() {
        const table = this.table;
        if (!table) return;
        const total = orderTotal(table);
        const { received, method } = this.state.pay;
        const out = this.querySelector('[data-change]');
        if (out) out.textContent = received >= total ? money(received - total) : '—';
        this.querySelector('[data-act="checkout"]')?.toggleAttribute('disabled', !(method === 'transfer' || received >= total));
    }

    select(patch) { Object.assign(this.state, patch); this.renderAll(); }

    actions() {
        return {
            'select-area': el => this.select({ areaId: el.dataset.id, tableId: null, filter: 'all' }),
            filter: el => { this.state.filter = el.dataset.v; this.renderFilters(); this.renderGrid(); },
            'select-table': el => {
                this.state.pay = { method: 'cash', received: 0 };
                this.state.tableId = el.dataset.id;
                this.renderGrid(); this.renderDetail();
            },
            'close-detail': () => { this.state.tableId = null; this.renderGrid(); this.renderDetail(); },
            'goto-primary': () => {
                const id = this.table?.mergedInto;
                if (id) { this.state.tableId = id; this.renderGrid(); this.renderDetail(); }
            },

            reactivate: async el => {
                const ok = await confirmDialog({ title: 'Kích hoạt lại khu vực', message: 'Khu vực này đã bị tạm ngưng có xác nhận muốn kích hoạt lại không?', confirmLabel: 'Kích hoạt' });
                if (ok) this.run(() => areaService.setAreaActive(el.dataset.id, true), 'Đã kích hoạt lại khu vực', { areaId: el.dataset.id, tableId: null });
            },
            'add-area': async () => {
                const res = await areaEditorDialog({ area: null });
                if (res?.saved) this.refresh({ areaId: res.saved, tableId: null });
            },
            'edit-area': async () => {
                if (!this.area) return;
                const res = await areaEditorDialog({ area: this.area });
                if (res) this.refresh({ areaId: res.saved ?? null, tableId: res.saved ? this.state.tableId : null });
            },
            'delete-area': async () => {
                const area = this.area;
                if (!area) return;
                const ok = await confirmDialog({
                    title: 'Xoá khu vực', message: 'Xác nhận xoá khu vực và toàn bộ bàn trong khu vực này hay không?',
                    confirmLabel: 'Xoá', confirmIcon: 'delete', variant: 'danger',
                });
                if (ok) this.run(() => areaService.deleteArea(area.id), 'Đã xoá khu vực', { areaId: null, tableId: null });
            },

            /* bàn */
            'open-table': async () => {
                const { table, area } = this;
                if (!table) return;
                const guests = await guestsDialog({ tableName: table.name, max: effectiveCapacity(table, area.tables) });
                if (guests) this.run(() => areaService.openTable(table.id, guests), `Đã mở ${table.name}`);
            },
            order: async () => {
                const table = this.table;
                if (!table) return;
                this.menu ??= await areaService.listMenu();
                const items = await orderDialog({ tableName: table.name, menu: this.menu });
                if (items?.length) this.run(() => areaService.addOrder(table.id, items), 'Đã thêm món vào bàn');
            },
            pay: () => {
                const table = this.table;
                this.state.pay = { method: 'cash', received: 0 };
                if (table) this.run(() => areaService.requestPayment(table.id));
            },
            'cancel-pay': () => { const t = this.table; if (t) this.run(() => areaService.cancelPayment(t.id)); },
            'pay-method': el => { this.state.pay.method = el.dataset.v; this.renderDetail(); },
            'quick-cash': el => {
                this.state.pay.received = Number(el.dataset.v);
                this.renderDetail();
            },
            checkout: () => {
                const t = this.table;
                if (!t) return;
                const { method, received } = this.state.pay;
                this.run(() => areaService.checkoutTable(t.id, { method, received }),
                    r => `Đã thanh toán ${money(r.total)}${r.change ? ` — trả lại ${money(r.change)}` : ''}`);
            },
            'cancel-reserve': async () => {
                const t = this.table;
                if (!t) return;
                const ok = await confirmDialog({ title: 'Huỷ đặt trước', message: `Huỷ đặt trước cho ${t.name}?`, confirmLabel: 'Huỷ đặt', confirmIcon: 'close', variant: 'danger' });
                if (ok) this.run(() => areaService.cancelReservation(t.id), 'Đã huỷ bàn đặt trước');
            },
            merge: async () => {
                const { table, area } = this;
                if (!table) return;
                const targetId = await pickTableDialog({
                    title: 'Gộp bàn', subtitle: 'Sơ đồ bàn (Bàn được chọn sẽ được đặt làm bàn chính)',
                    tables: area.tables.filter(t => t.id !== table.id),
                    reasonFor: t => ['empty', 'serving'].includes(t.status) ? null : 'Bàn không thể gộp ở trạng thái này',
                });
                if (targetId) this.run(() => areaService.mergeTables(table.id, targetId), 'Đã gộp bàn', { tableId: targetId });
            },
            move: async () => {
                const { table, area } = this;
                if (!table) return;
                const targetId = await pickTableDialog({
                    title: 'Chuyển bàn', subtitle: 'Sơ đồ bàn (chọn một bàn trống để chuyển tới)',
                    tables: area.tables.filter(t => t.id !== table.id),
                    reasonFor: t => t.status !== 'empty' ? 'Bàn đích phải đang trống'
                        : t.capacity < table.guests ? `Bàn chỉ chứa ${t.capacity} khách` : null,
                });
                if (targetId) this.run(() => areaService.moveTable(table.id, targetId), 'Đã chuyển bàn', { tableId: targetId });
            },
        };
    }
}

customElements.define('area-manager', AreaManager);