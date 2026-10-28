import { http, httpAll } from './HttpClient.js';

export const DEFAULT_CAPACITY = 4;

const SHOP_KEY = 'sr:shopId';
const PAYING_KEY = 'sr:payingTables';
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
    name: i.productName ?? i.productResponse?.name ?? '',
    price: Number(i.price) || 0,
    qty: i.quantity ?? 1,
}));

const mapTable = (t, order) => {
    const orders = order ? mapOrderItems(order) : [];
    const created = order?.itemResponses?.map(i => Date.parse(i.createdAt)).filter(Number.isFinite) ?? [];
    return {
        id: sid(t.id),
        name: t.name,
        qrEnabled: t.qrEnabled,
        capacity: DEFAULT_CAPACITY,
        status: order ? (paying.has(sid(t.id)) ? 'paying' : 'serving') : 'empty',
        guests: 0,
        startedAt: created.length ? Math.min(...created) : null,
        reservedAt: null,
        reservedUntil: null,
        orders,
        orderId: order ? sid(order.id) : null,
        mergedInto: null,
        mergedIds: [],
    };
};

let pendingByTable = new Map();

async function fetchPendingOrders(shopId) {
    const orders = await http('GET', `/order/${shopId}`, undefined, { query: { date: localDate() } });
    const map = new Map();
    for (const o of orders ?? []) if (o.orderStatus === 'PENDING' && o.table) map.set(sid(o.table.id), o);
    return map;
}

async function listAreas() {
    const shopId = await getShopId();
    const [areas, pending] = await Promise.all([httpAll(`/area/shop/${shopId}`), fetchPendingOrders(shopId)]);
    pendingByTable = pending;
    const tablesByArea = await Promise.all(areas.map(a => a.status === 'ACTIVE' ? httpAll(`/tables/area/${a.id}`) : []));
    for (const id of [...paying]) if (!pending.has(id)) paying.delete(id);
    savePaying();
    return areas.map((a, i) => ({
        id: sid(a.id),
        name: a.name,
        description: a.description ?? '',
        active: a.status === 'ACTIVE',
        tables: tablesByArea[i].filter(t => t.status === 'ACTIVE').map(t => mapTable(t, pending.get(sid(t.id)))),
    }));
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
    let o = pendingByTable.get(sid(tableId));
    if (!o) o = (await fetchPendingOrders(await getShopId())).get(sid(tableId));
    if (!o) throw new Error('Bàn này chưa có đơn hàng đang mở');
    return o.id;
}

export const springAreaService = {
    listAreas,
    listMenu,
    saveArea,
    deleteArea: id => http('DELETE', `/area/${id}`),
    setAreaActive: (id, active) => active ? http('PATCH', `/area/${id}/activate`) : http('DELETE', `/area/${id}`),

    openTable: async () => { throw new Error('Bàn sẽ tự chuyển sang "Đang phục vụ" khi bạn gọi món đầu tiên'); },

    addOrder: async (tableId, items) => http('POST', `/order/${await getShopId()}`, {
        tableId: Number(tableId),
        itemRequests: items.map(i => ({ productId: Number(i.id), quantity: i.qty, note: i.note ?? '' })),
    }),

    requestPayment: async id => { paying.add(sid(id)); savePaying(); },
    cancelPayment: async id => { paying.delete(sid(id)); savePaying(); },

    async checkoutTable(tableId, { received = 0 } = {}) {
        const shopId = await getShopId();
        const orderId = await orderIdOfTable(tableId);
        const res = await http('POST', `/order/${shopId}/payment/${orderId}`);
        paying.delete(sid(tableId)); savePaying();
        const total = Number(res?.totalPrice) || 0;
        return { total, change: Math.max(0, received - total) };
    },

    cancelReservation: async () => { throw new Error('Backend chưa hỗ trợ đặt bàn trước'); },

    async moveTable(fromId, toId) {
        return http('POST', `/order/${await getShopId()}/move-table`, undefined, { query: { fromId, toId } });
    },
    async mergeTables(fromId, primaryId) {
        return http('POST', `/order/${await getShopId()}/merge-table`, undefined, { query: { fromId, toId: primaryId } });
    },
};