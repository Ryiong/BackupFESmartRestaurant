import { esc, titleCase } from '../../utils/format.js';
import { ICONS } from '../../icon.js';
import { INGREDIENT_TYPES, DOC_TYPES, DOC_STATUS, stockState } from '../../services/StorageService.js';

export const FIELD_CLS = 'rounded-xl border border-support-600 bg-white py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500';
export const ICON_BTN = 'cursor-pointer rounded-lg p-1.5 text-primary-700 transition-all hover:scale-90 hover:bg-neutral-100';
const BADGE = 'inline-block rounded-full px-2.5 py-1 text-[11px] font-bold';

export const VIEWS = {
    ingredients: { label: 'Nguyên liệu', title: 'Kho nguyên liệu', sub: 'Danh sách nguyên liệu, trạng thái và tồn kho', search: 'Tìm tên, mã nguyên liệu…' },
    docs: { label: 'Phiếu kho', title: 'Phiếu kho', sub: 'Tạo, xem, duyệt hoặc từ chối phiếu vật tư', search: 'Tìm mã phiếu, người tạo, ghi chú…' },
    recipes: { label: 'Công thức món', title: 'Công thức món', sub: 'Định lượng nguyên liệu cho từng món ăn', search: 'Tìm tên món, danh mục…' },
};

export const num = n => (Number(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 3 });

/** Chấp nhận "1,5" và "1.5"; trả NaN nếu rỗng hoặc không phải số. */
export const parseNum = s => {
    const t = String(s ?? '').trim().replace(',', '.');
    return t === '' ? NaN : Number(t);
};

export const fmtDateTime = s => {
    const d = new Date(String(s ?? '').replace(/(\.\d{3})\d+/, '$1'));
    if (!s || Number.isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const STOCK_BADGE = {
    out: { text: 'Hết hàng', cls: 'bg-red-50 text-red-700' },
    low: { text: 'Sắp hết', cls: 'bg-amber-50 text-amber-700' },
    ok: { text: 'Đủ hàng', cls: 'bg-primary-100 text-primary-800' },
    inactive: { text: 'Ngưng dùng', cls: 'border border-primary-200 bg-neutral-100 text-secondary-700' },
};
export const DOC_STATUS_CLS = { PENDING: 'text-amber-600', CONFIRMED: 'text-primary-700', CANCELLED: 'text-red-500' };

const opts = (map, all) => `<option value="all">${all}</option>` + Object.entries(map).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');

export const headHtml = view => `
    <h1 class="text-2xl font-bold text-text">${VIEWS[view].title}</h1>
    <p class="text-sm text-text">${VIEWS[view].sub}</p>`;

export const tabsHtml = (view, badges = {}) => Object.entries(VIEWS).map(([v, cfg]) => {
    const on = v === view;
    const b = badges[v] ? ` <span class="ml-1 rounded-full ${v === 'docs' ? 'bg-amber-500' : 'bg-red-600'} px-1.5 py-0.5 text-[10px] text-white">${badges[v]}</span>` : '';
    return `<button type="button" role="tab" data-act="tab" data-v="${v}" aria-selected="${on}"
        class="cursor-pointer rounded-full border px-4 py-1.5 text-sm font-bold transition-all hover:scale-95 ${on ? 'border-primary-700 bg-primary-700 text-white' : 'border-primary-200 bg-white text-primary-700'}">${cfg.label}${b}</button>`;
}).join('');

export const toolbarHtml = view => {
    const search = `
        <label class="relative block min-w-56 flex-1 sm:max-w-80 sm:flex-none">
            <span class="sr-only">Tìm kiếm</span>
            <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary-700">${ICONS.search}</span>
            <input data-f="q" type="search" autocomplete="off" placeholder="${VIEWS[view].search}" class="${FIELD_CLS} w-full pl-9 pr-3">
        </label>`;
    const select = (f, label, html) => `
        <label class="block"><span class="sr-only">${label}</span>
            <select data-f="${f}" class="${FIELD_CLS} max-w-52 px-3 font-semibold">${html}</select></label>`;

    if (view === 'ingredients') {
        const stock = `<option value="all">Mọi trạng thái</option><option value="need">Cần nhập (hết + sắp hết)</option>
            <option value="out">Hết hàng</option><option value="low">Sắp hết</option><option value="ok">Đủ hàng</option><option value="inactive">Ngưng dùng</option>`;
        return `${search}${select('type', 'Loại', opts(INGREDIENT_TYPES, 'Mọi loại'))}${select('stock', 'Trạng thái', stock)}
            <div class="ml-auto"><p-button data-act="add-ingredient" label="Thêm nguyên liệu mới" icon="addBox" variant="solid"></p-button></div>`;
    }
    if (view === 'docs') {
        return `${search}${select('docType', 'Loại phiếu', opts(DOC_TYPES, 'Mọi loại phiếu'))}${select('docStatus', 'Trạng thái', opts(DOC_STATUS, 'Mọi trạng thái'))}
            <div class="ml-auto"><p-button data-act="add-doc" label="Tạo phiếu" icon="addBox" variant="solid"></p-button></div>`;
    }
    return search;
};

const table = (heads, rows) => `
    <div class="overflow-x-auto"><table class="w-full min-w-176 border-collapse text-sm">
        <thead><tr class="border-b border-primary-200 text-xs uppercase text-primary-700">
            ${heads.map(([label, cls = 'text-left']) => `<th scope="col" class="px-3 py-3 font-bold ${cls}">${label}</th>`).join('')}
        </tr></thead>
        <tbody>${rows}</tbody>
    </table></div>`;

const TD = 'px-3 py-3';
const ROW = 'border-b border-primary-100 last:border-0 hover:bg-neutral-50';

export const ingredientTable = list => table(
    [['Nguyên liệu'], ['Loại'], ['Đơn vị'], ['Tồn kho', 'text-right'], ['Mức cảnh báo', 'text-right'], ['Trạng thái', 'text-center'], ['', 'text-right']],
    list.map(i => {
        const st = STOCK_BADGE[stockState(i)];
        const tone = i.stock <= 0 ? 'text-red-700' : i.stock <= i.minStock ? 'text-amber-700' : 'text-text';
        return `<tr class="${ROW} ${i.active ? '' : 'opacity-70'}">
            <td class="${TD}"><p class="font-bold">${esc(titleCase(i.name))}</p><p class="text-xs text-secondary-700">${esc(i.code)}</p></td>
            <td class="${TD}">${esc(INGREDIENT_TYPES[i.type] ?? '')}${i.type === 'FRESH' && i.yieldRate ? `<p class="text-xs text-secondary-700">Thành phẩm ${num(i.yieldRate * 100)}%</p>` : ''}</td>
            <td class="${TD}">${esc(i.unit)}</td>
            <td class="${TD} text-right font-bold ${tone}">${num(i.stock)}</td>
            <td class="${TD} text-right text-secondary-700">${num(i.minStock)}</td>
            <td class="${TD} text-center"><span class="${BADGE} ${st.cls}">${st.text}</span></td>
            <td class="${TD} whitespace-nowrap text-right">
                <button type="button" data-act="edit-ingredient" data-id="${esc(i.id)}" class="${ICON_BTN}" title="Chỉnh sửa" aria-label="Chỉnh sửa ${esc(titleCase(i.name))}">${ICONS.edit}</button>
                <button type="button" data-act="toggle-ingredient" data-id="${esc(i.id)}" class="${ICON_BTN}" title="${i.active ? 'Ngừng dùng' : 'Dùng lại'}" aria-label="${i.active ? 'Ngừng dùng' : 'Dùng lại'} ${esc(titleCase(i.name))}">${i.active ? ICONS.eye : ICONS.eyeOff}</button>
            </td></tr>`;
    }).join(''));

export const docTable = list => table(
    [['Mã phiếu'], ['Loại'], ['Ngày tạo'], ['Người tạo'], ['Trạng thái', 'text-center'], ['', 'text-right']],
    list.map(d => `<tr class="${ROW}">
        <td class="${TD} font-bold">${esc(d.code)}${d.note ? `<p class="line-clamp-1 max-w-56 text-xs font-normal text-secondary-700" title="${esc(d.note)}">${esc(d.note)}</p>` : ''}</td>
        <td class="${TD}">${esc(DOC_TYPES[d.type] ?? d.type)}</td>
        <td class="${TD} whitespace-nowrap">${esc(fmtDateTime(d.createdAt))}</td>
        <td class="${TD}">${esc(d.createdBy)}</td>
        <td class="${TD} text-center font-bold ${DOC_STATUS_CLS[d.status] ?? ''}">${esc(DOC_STATUS[d.status] ?? d.status)}</td>
        <td class="${TD} text-right"><button type="button" data-act="doc-detail" data-id="${esc(d.id)}" class="cursor-pointer font-bold text-text underline hover:text-primary-700">Chi tiết</button></td>
    </tr>`).join(''));

export const recipeTable = list => table(
    [['Món'], ['Danh mục'], ['', 'text-right']],
    list.map(p => `<tr class="${ROW}">
        <td class="${TD} font-bold">${esc(titleCase(p.name))}</td>
        <td class="${TD} text-secondary-700">${esc(titleCase(p.categoryName))}</td>
        <td class="${TD} text-right"><button type="button" data-act="open-recipe" data-id="${esc(p.id)}" class="cursor-pointer font-bold text-text underline hover:text-primary-700">Công thức</button></td>
    </tr>`).join(''));

export const stateHtml = (message, { retry = false } = {}) => `
    <div class="flex flex-col items-center gap-3 py-16 text-center">
        <p class="max-w-md text-sm text-secondary-700">${esc(message)}</p>
        ${retry ? '<p-button data-act="retry" label="Thử lại" icon="check"></p-button>' : ''}
    </div>`;

export const skeletonRows = (n = 6) => `<div class="animate-pulse space-y-3 py-3">${Array.from({ length: n }, () => '<div class="h-9 rounded-lg bg-primary-50"></div>').join('')}</div>`;