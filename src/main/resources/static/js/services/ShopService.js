import { http } from './HttpClient.js';


const KEY = 'sr:shopId';
const store = {
    get: () => { try { return sessionStorage.getItem(KEY); } catch { return null; } },
    set: v => { try { sessionStorage.setItem(KEY, String(v)); } catch { /* noop */ } },
};

let cache = null;
const listeners = new Set();

export const STATUS_LABEL = {
    PENDING: { text: 'Chờ duyệt', cls: 'bg-amber-100 text-amber-800' },
    ACTIVE: { text: 'Đang hoạt động', cls: 'bg-ok-bg text-ok-fg' },
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

export async function updateShop (id, { name, address, phoneNumber, openTime, closeTime}) {
    const shop = await http('PUT', `/shop/${id}`, {
        name, address, phoneNumber, openTime, closeTime
    });
    await listShops({force: true});
    setCurrentShopId(id);
    return shop;
}


/* ---------- Vị trí & bán kính chấm công ---------- */

const LOC_KEY = id => `sr:shopLocation:${id}`;
const num = v => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** Các giới hạn khớp validator backend (kinh độ -180..180, vĩ độ -90..90, bán kính không âm). */
export const RADIUS_MAX = 1000; // backend không giới hạn; giao diện chặn ở 1 km để tránh nhập nhầm.
export const RADIUS_DEFAULT = 100;

export function validateLocation({ latitude, longitude, attendanceRadius }) {
    const lat = num(latitude), lng = num(longitude), r = num(attendanceRadius);
    if (lat === null || lat < -90 || lat > 90) return 'Vĩ độ phải nằm trong khoảng -90 đến 90.';
    if (lng === null || lng < -180 || lng > 180) return 'Kinh độ phải nằm trong khoảng -180 đến 180.';
    if (r === null || r <= 0) return 'Bán kính chấm công phải lớn hơn 0 mét.';
    if (r > RADIUS_MAX) return `Bán kính tối đa ${RADIUS_MAX} m.`;
    return '';
}

/**
 * Vị trí đã lưu của cửa hàng. `ShopResponse` hiện chưa trả latitude/longitude/attendanceRadius,
 * nên ưu tiên giá trị từ backend (khi được bổ sung), nếu không có thì dùng bản đã lưu trên trình duyệt này.
 * Trả về { latitude, longitude, attendanceRadius, source: 'server' | 'local' } hoặc null.
 */
export function getShopLocation(shop) {
    if (!shop) return null;
    const lat = num(shop.latitude), lng = num(shop.longitude), r = num(shop.attendanceRadius);
    if (lat !== null && lng !== null) return { latitude: lat, longitude: lng, attendanceRadius: r ?? RADIUS_DEFAULT, source: 'server' };
    try {
        const v = JSON.parse(localStorage.getItem(LOC_KEY(shop.id)) ?? 'null');
        if (v && num(v.latitude) !== null && num(v.longitude) !== null) return { ...v, source: 'local' };
    } catch { /* bỏ qua */ }
    return null;
}

/** PUT /shop/{id}/location (cần ROLE_OWNER + PERM_SHOP_SET_LOCATION). */
export async function updateShopLocation(id, { latitude, longitude, attendanceRadius }) {
    const body = { latitude: Number(latitude), longitude: Number(longitude), attendanceRadius: Number(attendanceRadius) };
    const res = await http('PUT', `/shop/${id}/location`, body);
    try { localStorage.setItem(LOC_KEY(id), JSON.stringify(body)); } catch { /* bỏ qua */ }
    await listShops({ force: true });
    return res;
}

/** Khoảng cách Haversine (mét), cùng công thức backend (R = 6.371.000 m). Chỉ để gợi ý; kết quả chính thức do backend quyết định. */
export function distanceMeters(a, b) {
    const rad = d => d * Math.PI / 180;
    const dLat = rad(b.latitude - a.latitude), dLng = rad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}
