import '../../components/PrimaryButton.js';
import { onShopChange } from '../../services/ShopService.js';
import { bindActions, confirmDialog, toast } from '../../utils/dialog.js';
import { titleCase } from '../../utils/format.js';
import { storageService, stockState, DOC_TYPES } from '../../services/StorageService.js';
import { menuService } from '../../services/MenuService.js';
import {
    headHtml, tabsHtml, toolbarHtml, ingredientTable, docTable, recipeTable, stateHtml, skeletonRows,
} from './StorageTemplates.js';
import { ingredientDialog, documentCreateDialog, documentDetailDialog, recipeDialog } from './StorageDialogs.js';

const fold = s => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').toLowerCase();

const NEED = { ingredients: ['ingredients'], docs: ['docs', 'ingredients'], recipes: ['products', 'ingredients'] };

class StorageManager extends HTMLElement {
    state = {
        view: 'ingredients',
        ingredients: [], docs: [], products: [],
        loaded: {}, loading: false, error: '',
        q: '', type: 'all', stock: 'all', docType: 'all', docStatus: 'all',
    };
    busy = false;

    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.build();
        bindActions(this, this.actions(), { capture: true });
        this.addEventListener('input', e => {
            if (e.target.dataset?.f === 'q') { this.state.q = e.target.value; this.renderBody(); }
        });
        this.addEventListener('change', e => {
            const f = e.target.dataset?.f;
            if (f && ['type', 'stock', 'docType', 'docStatus'].includes(f)) { this.state[f] = e.target.value; this.renderBody(); }
        });
        this.off = onShopChange(() => {
            this.state.loaded = {};
            this.setView(this.state.view);
        });
        this.setView('ingredients');
    }

    disconnectedCallback() { this.off?.(); }

    build() {
        this.innerHTML = `
        <div class="flex flex-col gap-4 pb-6">
            <div data-head></div>
            <div data-tabs class="flex flex-wrap gap-2" role="tablist" aria-label="Mục kho"></div>
            <div data-toolbar class="flex flex-wrap items-center gap-3"></div>
            <section class="min-h-112 rounded-2xl bg-white p-5 shadow-sm" aria-live="polite">
                <div class="flex justify-end"><span data-count class="text-sm text-secondary-700"></span></div>
                <div data-body></div>
            </section>
        </div>`;
        this.el = {
            head: this.querySelector('[data-head]'),
            tabs: this.querySelector('[data-tabs]'),
            toolbar: this.querySelector('[data-toolbar]'),
            count: this.querySelector('[data-count]'),
            body: this.querySelector('[data-body]'),
        };
    }

    /* ───── dữ liệu ───── */

    fetchers = {
        ingredients: async () => { this.state.ingredients = await storageService.listIngredients(); },
        docs: async () => { this.state.docs = await storageService.listDocuments(); },
        products: async () => { this.state.products = (await menuService.listMenu()).products.filter(p => p.active); },
    };

    async ensure(view, force = false) {
        const missing = NEED[view].filter(k => force || !this.state.loaded[k]);
        if (!missing.length) { this.renderBody(); return; }
        this.state.loading = true;
        this.state.error = '';
        this.renderBody();
        try {
            await Promise.all(missing.map(async k => { await this.fetchers[k](); this.state.loaded[k] = true; }));
        } catch (err) {
            this.state.error = err.message || 'Không tải được dữ liệu';
        }
        this.state.loading = false;
        this.renderTabs();
        this.renderBody();
    }

    invalidate(keys) {
        keys.forEach(k => { this.state.loaded[k] = false; });
        return this.ensure(this.state.view);
    }

    setView(view) {
        Object.assign(this.state, { view, q: '', type: 'all', stock: 'all', docType: 'all', docStatus: 'all' });
        this.el.head.innerHTML = headHtml(view);
        this.el.toolbar.innerHTML = toolbarHtml(view);
        this.renderTabs();
        this.ensure(view);
    }

    /* ───── hiển thị ───── */

    renderTabs() {
        const { ingredients, docs, loaded, view } = this.state;
        const badges = {
            ingredients: loaded.ingredients ? ingredients.filter(i => ['out', 'low'].includes(stockState(i))).length : 0,
            docs: loaded.docs ? docs.filter(d => d.status === 'PENDING').length : 0,
        };
        this.el.tabs.innerHTML = tabsHtml(view, badges);
    }

    get filtered() {
        const { view, q, type, stock, docType, docStatus, ingredients, docs, products } = this.state;
        const needle = fold(q.trim());
        if (view === 'ingredients') {
            return ingredients.filter(i => {
                const s = stockState(i);
                return (type === 'all' || i.type === type)
                    && (stock === 'all' || (stock === 'need' ? ['out', 'low'].includes(s) : s === stock))
                    && (!needle || fold(`${i.name} ${i.code} ${i.unit}`).includes(needle));
            });
        }
        if (view === 'docs') {
            return docs.filter(d => (docType === 'all' || d.type === docType)
                && (docStatus === 'all' || d.status === docStatus)
                && (!needle || fold(`${d.code} ${d.createdBy} ${d.note} ${DOC_TYPES[d.type] ?? ''}`).includes(needle)));
        }
        return products.filter(p => !needle || fold(`${p.name} ${p.categoryName}`).includes(needle));
    }

    renderBody() {
        const { view, loading, error } = this.state;
        const { body, count } = this.el;
        count.textContent = '';
        if (loading) { body.innerHTML = skeletonRows(); return; }
        if (error) { body.innerHTML = stateHtml(error, { retry: true }); return; }

        const all = { ingredients: this.state.ingredients, docs: this.state.docs, recipes: this.state.products }[view];
        const list = this.filtered;
        const unit = { ingredients: 'nguyên liệu', docs: 'phiếu', recipes: 'món' }[view];
        if (!all.length) {
            body.innerHTML = stateHtml({
                ingredients: 'Chưa có nguyên liệu nào. Nhấn “Thêm nguyên liệu mới” để bắt đầu.',
                docs: 'Chưa có phiếu kho nào. Nhấn “Tạo phiếu” để nhập, xuất hoặc ghi nhận hao hụt.',
                recipes: 'Chưa có món nào đang bán. Hãy thêm món ở trang Thực đơn.',
            }[view]);
            return;
        }
        count.textContent = `${list.length}/${all.length} ${unit}`;
        if (!list.length) { body.innerHTML = stateHtml('Không có kết quả phù hợp với bộ lọc.'); return; }
        body.innerHTML = { ingredients: ingredientTable, docs: docTable, recipes: recipeTable }[view](list);
    }

    find(key, id) { return this.state[key].find(x => String(x.id) === String(id)); }

    /* ───── hành động ───── */

    actions() {
        return {
            tab: el => { if (el.dataset.v !== this.state.view) this.setView(el.dataset.v); },
            retry: () => this.ensure(this.state.view, true),

            'add-ingredient': async () => {
                if (await ingredientDialog({})) this.invalidate(['ingredients', 'docs']);
            },
            'edit-ingredient': async el => {
                const ingredient = this.find('ingredients', el.dataset.id);
                if (ingredient && await ingredientDialog({ ingredient })) this.invalidate(['ingredients']);
            },
            'toggle-ingredient': async el => {
                const i = this.find('ingredients', el.dataset.id);
                if (!i || this.busy) return;
                if (i.active) {
                    const ok = await confirmDialog({
                        title: 'Ngừng dùng nguyên liệu',
                        message: `Xác nhận ngừng dùng “${titleCase(i.name)}”? Nguyên liệu sẽ không chọn được khi tạo phiếu. Bạn có thể bật lại bất cứ lúc nào.`,
                        confirmLabel: 'Ngừng dùng', confirmIcon: 'pause', variant: 'danger',
                    });
                    if (!ok) return;
                }
                this.busy = true;
                try {
                    await storageService.setIngredientActive(i.id, !i.active);
                    i.active = !i.active;
                    this.renderTabs(); this.renderBody();
                    toast(i.active ? 'Đã dùng lại nguyên liệu' : 'Đã ngừng dùng nguyên liệu', 'success');
                } catch (err) {
                    toast(err.message || 'Không đổi được trạng thái nguyên liệu');
                } finally { this.busy = false; }
            },

            'add-doc': async () => {
                const { ingredients } = this.state;
                if (!ingredients.some(i => i.active)) return toast('Hãy tạo nguyên liệu đang dùng trước khi tạo phiếu');
                if (await documentCreateDialog({ ingredients })) this.invalidate(['docs']);
            },
            'doc-detail': async el => {
                const doc = this.find('docs', el.dataset.id);
                if (doc && await documentDetailDialog({ doc, ingredients: this.state.ingredients })) this.invalidate(['docs', 'ingredients']);
            },

            'open-recipe': async el => {
                const product = this.find('products', el.dataset.id);
                if (product) await recipeDialog({ product, ingredients: this.state.ingredients });
            },
        };
    }
}

customElements.define('storage-manager', StorageManager);