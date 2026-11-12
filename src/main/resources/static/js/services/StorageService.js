import { http, httpAll } from './HttpClient.js';
import { getShopId } from './ShopService.js';

export const INGREDIENT_TYPES = { FRESH: 'Tươi sống', DRY: 'Khô' };
// , CANNED: 'Đóng hộp', FROZEN: 'Đông lạnh', OTHER: 'Khác'
export const DOC_TYPES = { IMPORT: 'Nhập kho', EXPORT: 'Xuất kho', WASTE: 'Hao hụt / huỷ' };
export const DOC_STATUS = { PENDING: 'Chờ duyệt', CONFIRMED: 'Đã duyệt', CANCELLED: 'Từ chối' };
const DOC_PREFIX = { IMPORT: 'PN', EXPORT: 'PX', WASTE: 'PH' };

export const recipeIdOf = productId => productId;

const pad = n => String(n).padStart(3, '0');
const collator = new Intl.Collator('vi');
const byName = (a, b) => collator.compare(a.name, b.name);
const n0 = v => Number(v) || 0;

const normIngredient = i => ({
    id: i.id,
    code: `NL-${pad(i.id)}`, // backend không có mã nguyên liệu -> sinh mã hiển thị từ id
    name: i.name ?? '',
    type: i.type,
    unit: i.unit ?? '',
    minStock: n0(i.minStock),
    yieldRate: n0(i.yieldRate),
    stock: n0(i.currentStock),
    active: i.status === 'ACTIVE',
});

/** out = hết hàng, low = sắp hết (tồn <= mức cảnh báo), ok = đủ, inactive = ngưng dùng */
export const stockState = i => !i.active ? 'inactive' : i.stock <= 0 ? 'out' : i.stock <= i.minStock ? 'low' : 'ok';

const personName = v => (v && typeof v === 'object' ? (v.name ?? v.email ?? '') : (v ?? ''));

const normDoc = d => ({
    id: d.id,
    code: `${DOC_PREFIX[d.type] ?? 'PK'}-${pad(d.id)}`,
    type: d.type,
    status: d.status,
    note: d.note ?? '',
    rejectReason: d.rejectReason ?? '',
    createdAt: d.createdAt ?? '',
    createdBy: personName(d.createdByName ?? d.createdBy),
    reviewedBy: personName(d.reviewedBy),
    reviewedAt: d.reviewedAt ?? '',
});

const normRecipeLine = l => ({
    id: l.id,
    quantity: n0(l.quantity),
    name: l.ingredientName ?? '',
    unit: l.ingredientUnit ?? '',
});

/*
 * InventoryDocumentResponse của backend KHÔNG có danh sách nguyên liệu của phiếu.
 * Lưu tạm ở trình duyệt lúc tạo phiếu để màn "Chi tiết phiếu" hiển thị được.
 * Phiếu tạo ở máy khác sẽ không có chi tiết cho tới khi backend trả items.
 */
const ITEMS_KEY = 'sr:docItems';
const readItems = () => {
    try { return JSON.parse(localStorage.getItem(ITEMS_KEY) ?? '{}'); } catch { return {}; }
};
const saveItems = (id, items) => {
    try {
        const all = readItems();
        all[String(id)] = items;
        localStorage.setItem(ITEMS_KEY, JSON.stringify(all));
    } catch { }
};

const ingredientBody = ({ name, type, unit, minStock, yieldRate }) => ({
    name, type, unit, minStock,
    ...(type === 'FRESH' ? { yieldRate } : {}), // DRY: backend bỏ qua yieldRate
});

async function listIngredients() {
    const shopId = await getShopId();
    return (await httpAll(`/ingredient/shop/${shopId}`)).map(normIngredient).sort(byName);
}

async function updateIngredient(id, data) {
    return normIngredient(await http('PUT', `/ingredient/${id}`, ingredientBody(data)));
}

const setIngredientActive = (id, active) => active
    ? http('PATCH', `/ingredient/${id}/activate`)
    : http('DELETE', `/ingredient/${id}`);

async function listDocuments() {
    const shopId = await getShopId();
    return (await httpAll(`/inventory-document/shop/${shopId}`)).map(normDoc).sort((a, b) => b.id - a.id);
}

async function createDocument({ type, note, items }) {
    const shopId = await getShopId();
    const res = await http('POST', `/inventory-document/${shopId}`, {
        note: note || '',
        type,
        items: items.map(i => ({ ingredientId: Number(i.ingredientId), quantity: Number(i.quantity) })),
    });
    if (res?.id != null) {
        saveItems(res.id, items.map(({ ingredientId, code, name, unit, quantity }) => ({ ingredientId, code, name, unit, quantity })));
    }
    return normDoc(res ?? {});
}

async function approveDocument(id) {
    const shopId = await getShopId();
    return http('PUT', `/inventory-document/${shopId}/approve`, { id: Number(id) });
}

async function rejectDocument(id, rejectReason) {
    const shopId = await getShopId();
    return http('PUT', `/inventory-document/${shopId}/reject`, { id: Number(id), rejectReason });
}

/** Tạo nguyên liệu; nếu có tồn kho ban đầu thì tự tạo + duyệt một phiếu NHẬP KHO (backend không cho set tồn trực tiếp). */
async function createIngredient(data, openingStock = 0) {
    const shopId = await getShopId();
    const ingredient = normIngredient(await http('POST', `/ingredient/${shopId}`, ingredientBody(data)));
    let stockError = '';
    if (openingStock > 0) {
        try {
            const doc = await createDocument({
                type: 'IMPORT',
                note: 'Tồn kho ban đầu',
                items: [{ ingredientId: ingredient.id, code: ingredient.code, name: ingredient.name, unit: ingredient.unit, quantity: openingStock }],
            });
            await approveDocument(doc.id);
        } catch (e) {
            stockError = e.message || 'lỗi không xác định';
        }
    }
    return { ingredient, stockError };
}

const recipePath = productId => `/recipe-ingredients/${recipeIdOf(productId)}`;

export const storageService = {
    listIngredients,
    createIngredient,
    updateIngredient,
    setIngredientActive,

    listDocuments,
    createDocument,
    approveDocument,
    rejectDocument,
    docItems: id => readItems()[String(id)] ?? [],

    async listRecipe(productId) {
        return ((await http('GET', recipePath(productId))) ?? []).map(normRecipeLine);
    },
    addRecipeLines: (productId, lines) =>
        http('POST', recipePath(productId), lines.map(l => ({ ingredientId: Number(l.ingredientId), quantity: Number(l.quantity) }))),
    updateRecipeLines: (productId, lines) =>
        http('PUT', recipePath(productId), lines.map(l => ({ id: Number(l.id), quantity: Number(l.quantity) }))),
    deleteRecipeLines: (productId, ids) =>
        http('DELETE', recipePath(productId), ids.map(Number)),
};