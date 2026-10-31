import '../components/PrimaryButton.js';
import { onShopChange } from '../services/ShopService.js';
import { bindActions, confirmDialog, toast } from '../utils/dialog.js';
import { esc, titleCase } from '../utils/format.js';
import { menuService } from '../services/MenuService.js';
import { productDialog, categoryDialog } from './MenuDialogs.js';
import { ICONS } from '../icon.js';
import { productCard, skeletonGrid, stateHtml } from './MenuTemplates.js';

const FIELD_CLS = 'rounded-xl border border-support-600 bg-white py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
 
const fold = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();
 
class MenuManager extends HTMLElement {
    state = { categories: [], products: [], loading: true, error: '', q: '', cat: 'all', status: 'all' };
    busy = false;
 
    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.build();
        bindActions(this, this.actions(), { capture: true });
        this.addEventListener('input', e => {
            if (e.target.dataset?.f === 'q') { this.state.q = e.target.value; this.renderGrid(); }
        });
        this.addEventListener('change', e => {
            const f = e.target.dataset?.f;
            if (f === 'cat' || f === 'status') { this.state[f] = e.target.value; this.renderGrid(); }
        });
        this.off = onShopChange(() => this.load({ resetFilters: true }));
        this.load();
    }
 
    disconnectedCallback() { this.off?.(); }
 
    build() {
        this.innerHTML = `
        <div class="flex flex-col gap-4 pb-6">
            <div class="flex flex-wrap items-center gap-3">
                <label class="relative block min-w-56 flex-1 sm:max-w-80 sm:flex-none">
                    <span class="sr-only">Tìm món</span>
                    <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-700">${ICONS.search}</span>
                    <input data-f="q" type="search" autocomplete="off" placeholder="Tìm tên món, danh mục…" class="${FIELD_CLS} w-full pl-9 pr-3">
                </label>
                <label class="block">
                    <span class="sr-only">Danh mục</span>
                    <select data-f="cat" class="${FIELD_CLS} max-w-48 px-3 font-semibold"></select>
                </label>
                <label class="block">
                    <span class="sr-only">Trạng thái</span>
                    <select data-f="status" class="${FIELD_CLS} px-3 font-semibold">
                        <option value="all">Mọi trạng thái</option>
                        <option value="active">Đang bán</option>
                        <option value="inactive">Ngưng phục vụ</option>
                    </select>
                </label>
                <div class="ml-auto flex flex-wrap gap-2.5">
                    <p-button data-act="add-product" label="Thêm món mới" icon="addBox" variant="solid"></p-button>
                    <p-button data-act="edit-categories" label="Chỉnh sửa danh mục" icon="edit" variant="solid"></p-button>
                </div>
            </div>
            <section class="min-h-112 rounded-2xl bg-white p-5 shadow-sm" aria-label="Danh sách món ăn">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <h2 class="text-lg font-bold">Danh sách món ăn</h2>
                    <span data-count class="text-sm text-secondary-700" aria-live="polite"></span>
                </div>
                <div data-grid class="mt-4 grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-4"></div>
            </section>
        </div>`;
        this.el = {
            cat: this.querySelector('[data-f="cat"]'),
            status: this.querySelector('[data-f="status"]'),
            q: this.querySelector('[data-f="q"]'),
            count: this.querySelector('[data-count]'),
            grid: this.querySelector('[data-grid]'),
            add: this.querySelector('[data-act="add-product"]'),
        };
    }
 
    async load({ resetFilters = false } = {}) {
        if (resetFilters) {
            Object.assign(this.state, { q: '', cat: 'all', status: 'all' });
            this.el.q.value = '';
            this.el.status.value = 'all';
        }
        this.state.loading = true;
        this.state.error = '';
        this.renderAll();
        try {
            const { categories, products } = await menuService.listMenu();
            Object.assign(this.state, { categories, products });
        } catch (err) {
            Object.assign(this.state, { categories: [], products: [], error: err.message || 'Không tải được thực đơn' });
        }
        this.state.loading = false;
        this.renderAll();
    }
 
    renderAll() { this.renderToolbar(); this.renderGrid(); }
 
    renderToolbar() {
        const { categories } = this.state;
        if (this.state.cat !== 'all' && !categories.some(c => String(c.id) === this.state.cat)) this.state.cat = 'all';
        this.el.cat.innerHTML = `<option value="all">Tất cả danh mục</option>` + categories.map(c =>
            `<option value="${esc(c.id)}" ${String(c.id) === this.state.cat ? 'selected' : ''}>${esc(titleCase(c.name))}${c.active ? '' : ' (ngưng)'}</option>`).join('');
        this.el.add.toggleAttribute('disabled', this.state.loading || !categories.some(c => c.active));
    }
 
    get filtered() {
        const { products, q, cat, status } = this.state;
        const needle = fold(q.trim());
        return products.filter(p =>
            (cat === 'all' || String(p.categoryId) === cat)
            && (status === 'all' || (status === 'active') === p.active)
            && (!needle || fold(`${p.name} ${p.categoryName} ${p.description}`).includes(needle)));
    }
 
    renderGrid() {
        const { loading, error, categories, products } = this.state;
        const g = this.el.grid;
        this.el.count.textContent = '';
        if (loading) { g.innerHTML = skeletonGrid(); return; }
        if (error) { g.innerHTML = stateHtml(error, { retry: true }); return; }
        if (!categories.length) { g.innerHTML = stateHtml('Cửa hàng chưa có danh mục nào. Nhấn “Chỉnh sửa danh mục” để tạo danh mục đầu tiên, sau đó thêm món.'); return; }
        if (!products.length) { g.innerHTML = stateHtml('Chưa có món nào. Nhấn “Thêm món mới” để bắt đầu.'); return; }
        const list = this.filtered;
        this.el.count.textContent = `${list.length}/${products.length} món`;
        g.innerHTML = list.length ? list.map(productCard).join('') : stateHtml('Không có món nào phù hợp với bộ lọc.');
    }
 
    product(el) { return this.state.products.find(p => String(p.id) === el.dataset.id); }
 
    actions() {
        return {
            retry: () => this.load(),
 
            'add-product': async () => {
                const { categories, cat } = this.state;
                if (!categories.some(c => c.active)) return toast('Hãy tạo danh mục đang hoạt động trước khi thêm món');
                const defaultCat = categories.find(c => String(c.id) === cat && c.active)?.id ?? null;
                if (await productDialog({ categories, categoryId: defaultCat })) this.load();
            },
 
            'edit-product': async el => {
                const product = this.product(el);
                if (product && await productDialog({ product, categories: this.state.categories })) this.load();
            },
 
            'toggle-product': async el => {
                const p = this.product(el);
                if (!p || this.busy) return;
                if (p.active) {
                    const ok = await confirmDialog({
                        title: 'Ngừng phục vụ món',
                        message: `Xác nhận ngừng phục vụ “${titleCase(p.name)}”? Món sẽ không hiện khi gọi món. Bạn có thể bật lại bất cứ lúc nào.`,
                        confirmLabel: 'Ngừng phục vụ', confirmIcon: 'pause', variant: 'danger',
                    });
                    if (!ok) return;
                }
                this.busy = true;
                try {
                    await menuService.setProductActive(p.id, !p.active);
                    p.active = !p.active;
                    this.renderGrid();
                    toast(p.active ? 'Đã phục vụ lại món' : 'Đã ngừng phục vụ món', 'success');
                } catch (err) {
                    toast(err.message || 'Không đổi được trạng thái món');
                } finally { this.busy = false; }
            },
 
            'edit-categories': async () => {
                const ctx = { dirty: false };
                await categoryDialog({ categories: this.state.categories, ctx });
                if (ctx.dirty) this.load();
            },
        };
    }
}
 
customElements.define('menu-manager', MenuManager);