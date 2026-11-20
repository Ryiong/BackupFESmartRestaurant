// Dữ liệu cho trang Quản lý đơn hàng: đơn đang mở theo bàn và lịch sử đơn theo ngày.
import { http } from './HttpClient.js';
import { areaService } from './AreaService.js';
import { getShopId, paidTotalOf } from './AreaService.spring.js';
import { orderTotal } from '../utils/format.js';

const pad = n => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return ymd(new Date(y, m - 1, d + n)); };

const PAID = new Set(['PAID', 'COMPLETED']);
const OPEN = new Set(['PENDING', 'OPEN', 'UNPAID']);

/** 'PAID' | 'OPEN' | 'OTHER' (huỷ hoặc trạng thái khác). */
export function orderState(o) {
    const st = String(o.orderStatus ?? o.status ?? '').toUpperCase();
    const pay = String(o.paymentStatus ?? '').toUpperCase();
    if (PAID.has(st) || PAID.has(pay)) return 'PAID';
    if (!st || OPEN.has(st)) return 'OPEN';
    return 'OTHER';
}

const mapItem = i => ({
    id: i.id != null ? String(i.id) : null,
    name: i.productName ?? i.productResponse?.name ?? '',
    price: Number(i.price) || 0,
    qty: i.quantity ?? 1,
    note: i.note ?? '',
    status: String(i.itemStatus ?? i.status ?? 'ACTIVE').toUpperCase(),
    deletedAt: i.deletedAt ? Date.parse(i.deletedAt) : null,
    deletedBy: i.deletedByUserName ?? null,
    createdAt: i.createdAt ? Date.parse(i.createdAt) : null,
    userName: i.userName ?? null,
});

const mapOrder = o => {
    const state = orderState(o);
    const rawItems = Array.isArray(o.itemResponses) ? o.itemResponses : null;
    const items = rawItems ? rawItems.map(mapItem) : null;
    // Tổng tiền: ưu tiên totalPrice server → ledger lúc thanh toán → sum món ACTIVE
    const activeTotal = items
        ? items.filter(i => i.status === 'ACTIVE').reduce((s, i) => s + i.price * i.qty, 0)
        : 0;
    const total = o.totalPrice != null
        ? Number(o.totalPrice)
        : (items ? activeTotal : (state === 'PAID' ? paidTotalOf(o.id) : 0));
    return {
        id: String(o.id),
        state,
        rawStatus: String(o.orderStatus ?? o.status ?? ''),
        tableId: o.table?.id ?? o.tableId ?? o.tableResponse?.id ?? null,
        tableName: o.table?.name ?? o.tableName ?? o.tableResponse?.name ?? '',
        method: o.paymentMethod === 'BANKING' ? 'transfer' : o.paymentMethod ? 'cash' : null,
        paidAt: o.paidAt ? Date.parse(o.paidAt) : null,
        createdAt: o.createdAt ? Date.parse(o.createdAt) : null,
        total,
        itemCount: items ? items.filter(i => i.status === 'ACTIVE').reduce((s, i) => s + i.qty, 0) : null,
        items, // full list (ACTIVE + INACTIVE) để trang đơn hiện ai xoá / lúc nào
    };
};

export const ordersApi = {
    /** Đơn của một ngày (theo ngày tạo đơn, giờ máy chủ). */
    async listByDate(date) {
        const shopId = await getShopId();
        const list = await http('GET', `/order/${shopId}`, undefined, { query: { date } });
        return (list ?? []).map(mapOrder).sort((a, b) => Number(b.id) - Number(a.id));
    },

    /** Mọi đơn chưa thanh toán, theo từng bàn (kể cả đơn từ những ngày trước). Cũ nhất lên đầu. */
    async listOpen() {
        const areas = await areaService.listAreas();
        return areas.filter(a => a.active).flatMap(a => a.tables
            .filter(t => t.status === 'serving' || t.status === 'paying')
            .map(t => ({
                tableId: t.id, tableName: t.name, areaName: a.name, orderId: t.orderId,
                startedAt: t.startedAt, items: t.orders, total: orderTotal(t), paying: t.status === 'paying',
            }))).sort((x, y) => (x.startedAt ?? 0) - (y.startedAt ?? 0));
    },

    /** Thanh toán đơn đang mở của bàn (backend tự tính tổng tiền). */
    pay: (tableId, total) => areaService.checkoutTable(tableId, { received: total }),
};
