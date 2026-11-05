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
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
    // Bàn đang dùng nếu: có đơn PENDING trong GET /order, hoặc bàn báo OCCUPIED,
    // hoặc vừa gọi món ở máy này và backend chưa báo bàn trống.
    // Chỉ tin backend: giỏ món local KHÔNG được tự làm bàn thành "đang dùng"
    const occupied = !!order || t.orderStatus === 'OCCUPIED';
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
        startedAt: local?.startedAt ?? (created.length ? Math.min(...created) : Date.now()),
        reservedAt: null,
        reservedUntil: null,
        orders: apiItems ?? local?.items ?? [],
        orderId: order?.id != null ? sid(order.id) : (local?.orderId ?? null),
        mergedInto: null,
        mergedIds: [],
    };
};

let pendingByTable = new Map();

const tableIdOf = o => o.table?.id ?? o.tableId ?? o.tableResponse?.id;
const isOpenOrder = o => {
    const st = String(o.orderStatus ?? o.status ?? '').toUpperCase();
    return st === 'PENDING' || st === 'OPEN' || st === 'UNPAID';
};

async function fetchPendingOrders(shopId, back = 1) {
    // Backend lọc theo ngày TẠO đơn (giờ server) -> quét cả các ngày trước để thấy đơn mở qua đêm / lệch múi giờ.
    // Quét từ cũ đến mới để đơn mới nhất của bàn được ưu tiên.
    const days = Array.from({ length: back + 1 }, (_, i) => localDate(new Date(Date.now() - (back - i) * 864e5)));
    const lists = await Promise.all(days.map(date => http('GET', `/order/${shopId}`, undefined, { query: { date } })));
    const orders = lists.flatMap(l => l ?? []);
    const map = new Map();
    for (const o of orders ?? []) {
        const tid = tableIdOf(o);
        if (tid != null && isOpenOrder(o)) map.set(sid(tid), o);
    }
    if (orders?.length && !map.size) console.warn('[AreaService] Không nhận ra đơn PENDING nào trong /order, mẫu:', orders[0]);
    return map;
}

async function listAreas() {
    const shopId = await getShopId();
    const [areas, pending] = await Promise.all([httpAll(`/area/shop/${shopId}`), fetchPendingOrders(shopId)]);
    pendingByTable = pending;
    const tablesByArea = await Promise.all(areas.map(a => a.status === 'ACTIVE' ? httpAll(`/tables/area/${a.id}`) : []));
    const occupiedIds = new Set();
    const result = areas.map((a, i) => ({
        id: sid(a.id),
        name: a.name,
        description: a.description ?? '',
        active: a.status === 'ACTIVE',
        tables: tablesByArea[i].filter(t => t.status === 'ACTIVE')
            .map(t => mapTable(t, pending.get(sid(t.id)), openOrders.get(sid(t.id)), occupiedIds)),
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
    const tid = sid(tableId);
    const shopId = await getShopId();
    let o = pendingByTable.get(tid) ?? (await fetchPendingOrders(shopId)).get(tid);
    const cached = openOrders.get(tid)?.orderId;
    // Bàn báo đang dùng nhưng chưa thấy đơn: quét rộng hơn (đơn mở từ vài ngày trước)
    if (!o && cached == null) o = (await fetchPendingOrders(shopId, 7)).get(tid);
    const id = o?.id ?? cached;
    if (id == null) throw new Error('Bàn này chưa có đơn hàng đang mở');
    return id;
}

export const springAreaService = {
    listAreas,
    listMenu,
    saveArea,
    setAreaActive: (id, active) => active ? http('PATCH', `/area/${id}/activate`) : http('DELETE', `/area/${id}`),

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