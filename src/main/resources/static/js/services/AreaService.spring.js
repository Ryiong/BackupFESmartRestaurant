import { http, httpAll } from './HttpClient.js';
import { CUSTOMER_BASE_URL, CUSTOMER_ORDER_PATH } from '../config.js';

export const DEFAULT_CAPACITY = 4;

const SHOP_KEY = 'sr:shopId';
const PAYING_KEY = 'sr:payingTables';
const ORDERS_KEY = 'sr:openOrders';
const store = {
    get: k => {
        try {
            return sessionStorage.getItem(k);
        } catch {
            return null;
        }
    },
    set: (k, v) => {
        try {
            sessionStorage.setItem(k, v);
        } catch { }
    },
};
const loadPaying = () => {
    try {
        return new Set(JSON.parse(store.get(PAYING_KEY) ?? '[]'));
    } catch {
        return new Set();
    }
};
const paying = loadPaying();
const savePaying = () => store.set(PAYING_KEY, JSON.stringify([...paying]));

/*
 * Backend không có API xem món của đơn đang mở (GET /order?date= trả itemResponses = null)
 * và POST /order chỉ trả các món VỪA thêm. Vì vậy giữ giỏ món theo bàn ở client:
 * tableId -> { orderId, startedAt, items: [{ key, name, price, qty }] }
 */
const loadOrders = () => {
    try {
        return new Map(Object.entries(JSON.parse(store.get(ORDERS_KEY) ?? '{}')));
    } catch {
        return new Map();
    }
};
const openOrders = loadOrders();
const saveOrders = () => store.set(ORDERS_KEY, JSON.stringify(Object.fromEntries(openOrders)));

/*
 * Sổ doanh thu: GET /order?date= luôn trả totalPrice = null, chỉ response của /payment mới có tổng tiền.
 * Ghi lại tổng tiền từng đơn lúc thanh toán (localStorage, bền qua tab/ngày) để trang Doanh thu dùng.
 */
const LEDGER_KEY = 'sr:paidLedger';
const readLedger = () => {
    try { return JSON.parse(localStorage.getItem(LEDGER_KEY) ?? '{}'); } catch { return {}; }
};
const recordPaid = (orderId, total) => {
    try {
        const l = readLedger();
        l[sid(orderId)] = total;
        localStorage.setItem(LEDGER_KEY, JSON.stringify(l));
    } catch { }
};
export const paidTotalOf = orderId => Number(readLedger()[sid(orderId)]) || 0;

const sid = v => String(v);

let shopPromise = null;
export function getShopId() {
    shopPromise ??= (async () => {
        const shops = await http('GET', '/shop/me');
        if (!shops?.length) throw new Error('Tài khoản chưa có cửa hàng nào');
        const saved = store.get(SHOP_KEY);
        const shop = shops.find(s => sid(s.id) === saved) ?? shops[0];
        store.set(SHOP_KEY, sid(shop.id));
        return shop.id;
    })().catch(err => { shopPromise = null; throw err; });
    return shopPromise;
}

const mapOrderItems = o => (o.itemResponses ?? []).map(i => ({
    key: sid(i.productResponse?.id ?? i.productId ?? i.productName),
    name: i.productName ?? i.productResponse?.name ?? '',
    price: Number(i.price) || 0,
    qty: i.quantity ?? 1,
}));

function mergeItems(target, items) {
    for (const it of items) {
        const ex = target.find(x => x.key === it.key);
        if (ex) ex.qty += it.qty;
        else target.push({ ...it });
    }
    return target;
}

const mapTable = (t, order, local, occupiedIds) => {
    const tid = sid(t.id);
    // Bàn đang dùng khi và chỉ khi GET /order/table/{id} trả về một đơn đang mở.
    // Giỏ món lưu ở máy này KHÔNG được tự làm bàn thành "đang dùng".
    const occupied = !!order;
    if (!occupied) {
        openOrders.delete(tid);
        return {
            id: tid, name: t.name, qrEnabled: t.qrEnabled, capacity: DEFAULT_CAPACITY, status: 'empty', guests: 0,
            startedAt: null, reservedAt: null, reservedUntil: null, orders: [], orderId: null, mergedInto: null, mergedIds: [],
        };
    }
    occupiedIds.add(tid);
    const apiItems = order?.itemResponses?.length ? mapOrderItems(order) : null;
    const created = order?.itemResponses?.map(i => Date.parse(i.createdAt)).filter(Number.isFinite) ?? [];
    return {
        id: tid,
        name: t.name,
        qrEnabled: t.qrEnabled,
        capacity: DEFAULT_CAPACITY,
        status: paying.has(tid) ? 'paying' : 'serving',
        guests: 0,
        startedAt: local?.startedAt ?? (Date.parse(order?.createdAt) || (created.length ? Math.min(...created) : Date.now())),
        reservedAt: null,
        reservedUntil: null,
        orders: apiItems ?? local?.items ?? [],
        orderId: order?.id != null ? sid(order.id) : (local?.orderId ?? null),
        mergedInto: null,
        mergedIds: [],
    };
};

/*
 * Đơn đang mở của MỘT bàn: GET /order/table/{tableId}.
 * Đây là nguồn duy nhất để biết bàn trống hay đang dùng (không còn quét /order?date=, vì quét theo ngày
 * sẽ bỏ sót đơn chưa thanh toán từ những ngày trước).
 * Chấp nhận cả trường hợp backend trả một đơn, một mảng đơn, hoặc null; 404 nghĩa là bàn chưa có đơn mở.
 */
const OPEN_STATUS = new Set(['PENDING', 'OPEN', 'UNPAID']);
const isOpenOrder = o => {
    const st = String(o?.orderStatus ?? o?.status ?? '').toUpperCase();
    return !st || OPEN_STATUS.has(st); // không có trạng thái thì coi là đơn đang mở (đúng ngữ nghĩa "đơn của bàn")
};

async function fetchTableOrder(tableId) {
    let res;
    try {
        res = await http('GET', `/order/table/${tableId}`);
    } catch (err) {
        if (err.status === 404) return null; // bàn chưa có đơn nào đang mở
        throw err; // lỗi khác (mất kết nối, 403...) không được hiểu thành "bàn trống"
    }
    const list = (Array.isArray(res) ? res : res?.content ?? [res]).filter(o => o && o.id != null && isOpenOrder(o));
    // nếu có nhiều đơn mở thì lấy đơn mới nhất
    return list.sort((x, y) => Number(y.id) - Number(x.id))[0] ?? null;
}

/** Chạy fn trên từng phần tử với tối đa `limit` request song song. */
async function pool(items, fn, limit = 6) {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
    }));
    return out;
}

async function listAreas() {
    const shopId = await getShopId();
    const areas = await httpAll(`/area/shop/${shopId}`);
    const tablesByArea = await Promise.all(areas.map(a => a.status === 'ACTIVE' ? httpAll(`/tables/area/${a.id}`) : []));
    // Mỗi bàn đang hoạt động hỏi riêng đơn của bàn đó để biết còn trống hay không.
    const activeTables = tablesByArea.flat().filter(t => t.status === 'ACTIVE');
    const orders = await pool(activeTables, t => fetchTableOrder(t.id));
    const orderByTable = new Map(activeTables.map((t, i) => [sid(t.id), orders[i]]));
    const occupiedIds = new Set();
    const result = areas.map((a, i) => ({
        id: sid(a.id),
        name: a.name,
        description: a.description ?? '',
        active: a.status === 'ACTIVE',
        tables: tablesByArea[i].filter(t => t.status === 'ACTIVE')
            .map(t => mapTable(t, orderByTable.get(sid(t.id)), openOrders.get(sid(t.id)), occupiedIds)),
        pausedTables: tablesByArea[i].filter(t => t.status !== 'ACTIVE')
            .map(t => ({ id: sid(t.id), name: t.name, capacity: DEFAULT_CAPACITY })),
    }));
    for (const id of [...paying]) if (!occupiedIds.has(id)) paying.delete(id);
    savePaying();
    saveOrders();
    return result;
}

async function saveArea(a) {
    const shopId = await getShopId();
    let areaId = a.id;
    let current = [];
    if (areaId) {
        const cur = await http('GET', `/area/${areaId}`);
        await http('PUT', `/area/${areaId}`, { name: a.name, description: a.description ?? cur?.description ?? '' });
        current = (await httpAll(`/tables/area/${areaId}`)).filter(t => t.status === 'ACTIVE');
    } else {
        areaId = (await http('POST', `/area/${shopId}`, { name: a.name, description: a.description ?? '' })).id;
    }

    const keep = new Map((a.tables ?? []).filter(t => t.id).map(t => [sid(t.id), t]));
    console.log('Danh sách ID giữ lại:', [...keep.keys()], 'Hiện tại trên server:', current.map(t => sid(t.id)));
    for (const t of current) if (!keep.has(sid(t.id))) await http('DELETE', `/tables/${t.id}`);
    for (const t of current) {
        const next = keep.get(sid(t.id));
        if (next && next.name !== t.name) await http('PUT', `/tables/${t.id}`, { name: next.name, qrEnabled: t.qrEnabled });
    }
    for (const t of (a.tables ?? []).filter(t => !t.id)) await http('POST', `/tables/area/${areaId}`, { name: t.name, qrEnabled: true });
    
    return { id: sid(areaId) };
}

let menuCache = null;
async function listMenu() {
    const shopId = await getShopId();
    const cats = await httpAll(`/category/shop/${shopId}`, { status: 'ACTIVE' });
    const lists = await Promise.all(cats.map(c => httpAll(`/product/category/${c.id}`, { status: 'ACTIVE' })));
    menuCache = lists.flat().map(p => ({ id: sid(p.id), name: p.name, price: Number(p.price) || 0, imageUrl: p.imageUrl }));
    return menuCache;
}

async function orderIdOfTable(tableId) {
    const o = await fetchTableOrder(tableId);
    const id = o?.id ?? openOrders.get(sid(tableId))?.orderId;
    if (id == null) throw new Error('Bàn này chưa có đơn hàng đang mở');
    return id;
}

export const springAreaService = {
    listAreas,
    listMenu,
    saveArea,
    setAreaActive: (id, active) => active ? http('PATCH', `/area/${id}/activate`) : http('DELETE', `/area/${id}`),
    setTableActive: (id, active) => active ? http('PATCH', `/tables/${id}/activate`) : http('DELETE', `/tables/${id}`),

    setTableQr: (tableId, enabled, name) => http('PUT', `/tables/${tableId}`, { name, qrEnabled: !!enabled }),

    async tableOrderUrl(tableId) {
        const shopId = await getShopId();
        const u = new URL(CUSTOMER_ORDER_PATH, CUSTOMER_BASE_URL || location.origin);
        u.searchParams.set('shop', shopId);
        u.searchParams.set('table', tableId);
        return u.toString();
    },

    openTable: async () => { throw new Error('Bàn sẽ tự chuyển sang "Đang phục vụ" khi bạn gọi món đầu tiên'); },

    async addOrder(tableId, items) {
        const res = await http('POST', `/order/${await getShopId()}`, {
            tableId: Number(tableId),
            itemRequests: items.map(i => ({ productId: Number(i.id), quantity: i.qty, note: i.note ?? '' })),
        });
        console.info('[AreaService] POST /order trả về:', res);
        if (res?.id == null) throw new Error('Backend không trả về đơn hàng sau khi gọi món (xem Console: "POST /order trả về")');
        const tid = sid(tableId);
        const entry = openOrders.get(tid) ?? { orderId: res.id, startedAt: Date.now(), items: [] };
        if (res?.id != null) entry.orderId = sid(res.id);
        // POST /order chỉ trả các món vừa thêm -> cộng dồn; nếu không có itemResponses thì dùng chính dữ liệu đã gửi
        const added = res?.itemResponses?.length
            ? mapOrderItems(res)
            : items.map(i => ({ key: sid(i.id), name: i.name, price: Number(i.price) || 0, qty: i.qty }));
        mergeItems(entry.items, added);
        openOrders.set(tid, entry);
        saveOrders();
        return res;
    },

    requestPayment: async id => { paying.add(sid(id)); savePaying(); },
    cancelPayment: async id => { paying.delete(sid(id)); savePaying(); },

    async checkoutTable(tableId, { received = 0 } = {}) {
        const shopId = await getShopId();
        const orderId = await orderIdOfTable(tableId);
        const res = await http('POST', `/order/${shopId}/payment/${orderId}`);
        const tid = sid(tableId);
        const localTotal = (openOrders.get(tid)?.items ?? []).reduce((s, i) => s + i.price * i.qty, 0);
        const total = Number(res?.totalPrice) || localTotal;
        recordPaid(orderId, total);
        paying.delete(tid); savePaying();
        openOrders.delete(tid); saveOrders();
        return { total, change: Math.max(0, received - total) };
    },

    cancelReservation: async () => { throw new Error('Backend chưa hỗ trợ đặt bàn trước'); },

    async moveTable(fromId, toId) {
        const r = await http('POST', `/order/${await getShopId()}/move-table`, undefined, { query: { fromId, toId } });
        const from = sid(fromId), to = sid(toId);
        const entry = openOrders.get(from);
        if (entry) { openOrders.set(to, entry); openOrders.delete(from); saveOrders(); }
        if (paying.delete(from)) { paying.add(to); savePaying(); }
        return r;
    },
    async mergeTables(fromId, primaryId) {
        const r = await http('POST', `/order/${await getShopId()}/merge-table`, undefined, { query: { fromId, toId: primaryId } });
        const from = sid(fromId), to = sid(primaryId);
        const src = openOrders.get(from);
        if (src) {
            const dst = openOrders.get(to) ?? { orderId: null, startedAt: src.startedAt, items: [] };
            mergeItems(dst.items, src.items);
            dst.startedAt = Math.min(dst.startedAt ?? Infinity, src.startedAt ?? Infinity);
            openOrders.set(to, dst);
            openOrders.delete(from);
            saveOrders();
        }
        paying.delete(from); savePaying();
        return r;
    },
};
