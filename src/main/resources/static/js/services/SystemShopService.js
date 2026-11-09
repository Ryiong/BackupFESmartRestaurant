// API duyệt cửa hàng dành cho quản trị viên hệ thống (role ADMIN). Backend giữ nguyên, chỉ gọi lại các endpoint có sẵn.
import { http } from './HttpClient.js';

export const SHOP_TABS = [
    { status: 'PENDING', label: 'Chờ duyệt' },
    { status: 'ACTIVE', label: 'Đang hoạt động' },
    { status: 'LOCKED', label: 'Đã khoá' },
];

/** GET /shop?status=&page=&size= -> { items, total, pages } */
export async function listShopsByStatus(status, { page = 0, size = 10 } = {}) {
    const r = await http('GET', '/shop', undefined, { query: { status, page, size } });
    const items = Array.isArray(r) ? r : (r?.content ?? []);
    return { items, total: r?.totalElements ?? items.length, pages: Math.max(1, r?.totalPages ?? 1) };
}

/** Số cửa hàng theo từng trạng thái (cho nhãn đếm trên các tab). */
export async function countShops() {
    const res = await Promise.all(SHOP_TABS.map(t => listShopsByStatus(t.status, { size: 1 }).then(r => r.total).catch(() => null)));
    return Object.fromEntries(SHOP_TABS.map((t, i) => [t.status, res[i]]));
}

export const approveShop = id => http('PATCH', `/shop/${id}/approve`);
export const rejectShop = (id, reason) => http('PATCH', `/shop/${id}/reject`, { reason });
export const lockShop = (id, reason) => http('PATCH', `/shop/${id}/lock`, { reason });
export const unlockShop = id => http('PATCH', `/shop/${id}/unlock`);
