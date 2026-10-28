import { http } from './HttpClient.js';

/**
 * Cửa hàng của người dùng hiện tại.
 *   GET  /shop/me  → List<ShopResponse>  {id,name,address,phoneNumber,openTime,closeTime,status,statusReason}
 *   POST /shop     → ShopResponse        (status = PENDING, chờ ADMIN duyệt)
 * Cửa hàng đang chọn được nhớ trong sessionStorage để các trang dùng chung.
 */
const KEY = 'sr:shopId';
const store = {
    get: () => { try { return sessionStorage.getItem(KEY); } catch { return null; } },
    set: v => { try { sessionStorage.setItem(KEY, String(v)); } catch { /* noop */ } },
};

let cache = null;
const listeners = new Set();

export const STATUS_LABEL = {
    PENDING: { text: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-800' },
    ACTIVE: { text: 'Đang hoạt động', cls: 'bg-primary-100 text-primary-800' },
    LOCKED: { text: 'Đã khoá', cls: 'bg-red-100 text-red-700' },
};

export function listShops({ force = false } = {}) {
    if (force || !cache) {
        cache = http('GET', '/shop/me').then(r => r ?? []).catch(err => { cache = null; throw err; });
    }
    return cache;
}

export async function getCurrentShop() {
    const shops = await listShops();
    if (!shops.length) return null;
    return shops.find(s => String(s.id) === store.get()) ?? shops[0];
}

export async function getShopId() {
    const shop = await getCurrentShop();
    if (!shop) throw new Error('Tài khoản chưa có cửa hàng, hãy tạo cửa hàng ở trang Tổng quan');
    return shop.id;
}

export function setCurrentShopId(id) {
    store.set(id);
    listeners.forEach(fn => fn(id));
}

export function onShopChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function createShop({ name, address, phoneNumber, openTime, closeTime }) {
    const shop = await http('POST', '/shop', { name, address, phoneNumber, openTime, closeTime });
    await listShops({ force: true });
    setCurrentShopId(shop.id);
    return shop;
}
