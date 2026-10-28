import { orderTotal } from '../utils/format.js';
import { revenueStore } from './RevenueStore.js';

const KEY = 'sr:areas:v1';
const wait = (ms = 120) => new Promise(r => setTimeout(r, ms));
const uid = p => `${p}-${crypto.randomUUID().slice(0, 8)}`;
const ago = min => Date.now() - min * 60000;
const today = (h, m = 0) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.getTime();
};

export const DEMOMENU = [
    {
        id: 'm1',
        name: 'Gỏi cuốn tôm thịt',
        price: 85000
    },
    {
        id: 'm2',
        name: 'Phở bò',
        price: 95000
    },
    {
        id: 'm3',
        name: 'Chả giò cua bể',
        price: 120000
    },
    {
        id: 'm4',
        name: 'Cơm chiên hải sản',
        price: 110000
    },
    {
        id: 'm5',
        name: 'Lẩu thái hải sản',
        price: 350000
    },
    {
        id: 'm6',
        name: 'Bia Tiger',
        price: 25000
    },
    {
        id: 'm7',
        name: 'Nước ngọt',
        price: 20000
    },
    {
        id: 'm8',
        name: 'Trà đá',
        price: 10000
    },
];

const newTable = (name, capacity, extra = {}) => ({
    id: uid('t'),
    name,
    capacity,
    status: 'empty',
    guests: 0,
    startedAt: null,
    reservedAt: null,
    reservedUntil: null,
    orders: [],
    mergedInto: null,
    mergedIds: [],
    ...extra,
});

const item = (name, price, qty) => ({ name, price, qty });

function seed() {
    const area = (name, tables, active = true) => ({
        id: uid('a'), name, active, tables
    });

    return [
        area('Sân vườn', [
            newTable('Bàn A01', 2),
            newTable('Bàn A02', 2, {
                status: 'serving',
                guests: 2,
                startedAt: ago(45),
                orders: [
                    item('Gỏi cuốn tôm thịt', 85000, 1),
                    item('Phở bò', 95000, 2),
                    item('Chả giò cua bể', 120000, 1)
                ]
            }),
            newTable('Bàn A03', 6, {
                status: 'serving',
                guests: 5,
                startedAt: ago(15),
                orders: [
                    item('Cơm chiên hải sản', 110000, 3)
                ]
            }),
            newTable('Bàn A04', 6, {
                status: 'reserved',
                guests: 6,
                reservedAt: today(19),
                reservedUntil: today(20)
            }),
        ]),
        area('Tầng trệt', [
            newTable('Bàn B01', 2),
            newTable('Bàn B02', 4, {
                status: 'serving',
                guests: 3,
                startedAt: ago(60),
                orders: [item('Lẩu thái hải sản', 350000, 1),
                item('Bia Tiger', 25000, 3)]
            }),
            newTable('Bàn B03', 4),
            newTable('Bàn B04', 12, {
                status: 'serving',
                guests: 9,
                startedAt: ago(10),
                orders: [item('Phở bò đặc biệt', 95000, 4)]
            }),
        ]),
        area('Phòng VVIP', [
            newTable('VIP 01', 10),
            newTable('VIP 02', 12)
        ]),
        area('Tầng 3', [
            newTable('T3-01', 4),
            newTable('T3-02', 6)
        ], false),
    ];
}

const load = () => {
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    }
    catch { }
    const db = seed();
    save(db);
    return db;
};

const save = db => {
    try {
        localStorage.setItem(KEY, JSON.stringify(db));
    }
    catch { }
};

export const seedAreas = () => seed();

// Driver lưu bằng localStorage. Driver khác (MockAPI...) chỉ cần cùng 2 hàm load/save.
export const localAreaDriver = {
    async load() {
        await wait();
        return load();
    },
    async save(db) {
        save(db);
    },
};

function find(db, id) {
    for (const area of db) {
        const table = area.tables.find(t => t.id === id);
        if (table) return { area, table };
    }
    throw new Error('Không tìm thấy bàn');
}

const reset = t => Object.assign(t, {
    status: 'empty',
    guests: 0,
    startedAt: null,
    reservedAt: null,
    reservedUntil: null,
    orders: [],
    mergedInto: null,
    mergedIds: [],
});
const capOf = (area, t) => t.capacity + t.mergedIds.reduce((s, id) => s + (area.tables.find(x => x.id === id)?.capacity ?? 0), 0);
const addItem = (orders, it) => {
    const found = orders.find(o => o.name === it.name && o.price === it.price);
    if (found) {
        found.qty += it.qty;
    } else {
        orders.push({
            name: it.name,
            price: it.price,
            qty: it.qty
        });
    }
};

export function createAreaService({ driver, recordSale }) {
    // Chạy fn trên bản sao DB; chỉ lưu khi fn không ném lỗi.
    async function tx(fn) {
        const db = await driver.load();
        const before = structuredClone(db);
        const out = fn(db);
        await driver.save(db, before);
        return structuredClone(out ?? null);
    }

    return {
    listAreas: () => tx(db => db),
    listMenu: async () => {
        await wait(60);
        return structuredClone(DEMOMENU);
    },

    saveArea: payload => tx(db => {
        const name = String(payload.name ?? '').trim();
        if (!name) {
            throw new Error('Vui lòng nhập tên khu vực');
        }
        if (db.some(a => a.id !== payload.id && a.name.toLowerCase() === name.toLowerCase())) {
            throw new Error('Tên khu vực đã tồn tại');
        }

        const seen = new Set();
        for (const t of payload.tables) {
            const n = String(t.name ?? '').trim();
            if (!n) {
                throw new Error('Tên bàn không được để trống');
            }
            if (seen.has(n.toLowerCase())) {
                throw new Error(`Tên bàn "${n}" bị trùng`);
            }
            seen.add(n.toLowerCase());
            const c = Number(t.capacity);
            if (!Number.isInteger(c) || c < 1 || c > 50) {
                throw new Error('Sức chứa không hợp lệ');
            }
        }

        let area = payload.id ? db.find(a => a.id === payload.id) : null;
        if (payload.id && !area) {
            throw new Error('Không tìm thấy khu vực');
        }
        if (!area) {
            area = {
                id: uid('a'),
                name,
                active: true,
                tables: []
            };
            db.push(area);
        }

        const keep = new Set(payload.tables.filter(t => t.id).map(t => t.id));
        for (const t of area.tables) {
            if (!keep.has(t.id) && t.status !== 'empty') {
                throw new Error(`${t.name} đang được sử dụng, không thể xoá`);
            }
        }

        const old = area.tables;
        area.name = name;
        area.tables = payload.tables.map(t => 
            Object.assign(old.find(x => x.id === t.id) ?? newTable('', 1), {
                name: String(t.name).trim(),
                capacity: Number(t.capacity)
            })
        );

        return area;
    }),

    deleteArea: id => tx(db => {
        const i = db.findIndex(a => a.id === id);
        if (i < 0) {
            throw new Error('Không tìm thấy khu vực');
        }
        if (db[i].tables.some(t => t.status !== 'empty')) {
            throw new Error('Khu vực còn bàn đang sử dụng hoặc đã đặt trước');
        }
        db.splice(i, 1);
    }),

    setAreaActive: (id, active) => tx(db => {
        const a = db.find(x => x.id === id);
        if (!a) {
            throw new Error('Không tìm thấy khu vực');
        }
        if (!active && a.tables.some(t => t.status !== 'empty')) {
            throw new Error('Khu vực còn bàn đang sử dụng hoặc đã đặt trước');
        }
        a.active = active;
        return a;
    }),

    openTable: (id, guests) => tx(db => {
        const { area, table } = find(db, id);
        if (!['empty', 'reserved'].includes(table.status)) {
            throw new Error('Bàn không ở trạng thái có thể mở');
        }
        const n = Number(guests);
        if (!Number.isInteger(n) || n < 1) {
            throw new Error('Số khách không hợp lệ');
        }
        if (n > capOf(area, table)) {
            throw new Error(`Bàn chỉ chứa tối đa ${capOf(area, table)} khách`);
        }
        Object.assign(table, {
            status: 'serving',
            guests: n,
            startedAt: Date.now(),
            reservedAt: null,
            reservedUntil: null,
            orders: []
        });
        return table;
    }),

    addOrder: (id, items) => tx(db => {
        const { table } = find(db, id);
        if (table.status !== 'serving') {
            throw new Error('Chỉ đặt món được cho bàn đang phục vụ');
        }
        for (const it of items) {
            if (it.qty > 0) {
                addItem(table.orders, it);
            }
        }
        return table;
    }),

    requestPayment: id => tx(db => {
        const { table } = find(db, id);
        if (table.status !== 'serving') {
            throw new Error('Bàn không ở trạng thái phục vụ');
        }
        if (!table.orders.length) {
            throw new Error('Bàn chưa có món nào để thanh toán');
        }
        table.status = 'paying';
        return table;
    }),

    cancelPayment: id => tx(db => {
        const { table } = find(db, id);
        if (table.status !== 'paying') {
            throw new Error("Bàn không ở trạng thái thanh toán");
        }
        table.status = 'serving';
        return table;
    }),

    checkoutTable: async (id, { method, received = 0 }) => {
        let sale;
        const result = await tx(db => {
            const { area, table } = find(db, id);
            if (table.status !== 'paying') {
                throw new Error("Bàn chưa yêu cầu thanh toán");
            }
            const total = orderTotal(table);
            if (method === 'cash' && received < total) {
                throw new Error("Số tiền khách đưa chưa đủ");
            }
            sale = {
                tableName: table.name,
                areaName: area.name,
                method: method === 'cash' ? 'cash' : 'transfer',
                total
            };
            for (const cid of table.mergedIds) {
                const c = area.tables.find(x => x.id === cid);
                if (c) {
                    reset(c);
                }
            }
            reset(table);
            return {
                total,
                change: method === 'cash' ? received - total : 0
            };
        });
        try {
            await recordSale(sale);
        } catch (err) {
            throw new Error(`Đã trả bàn nhưng chưa ghi được hoá đơn: ${err.message}`);
        }
        return result;
    },

    cancelReservation: id => tx(db => {
        const { table } = find(db, id);
        if (table.status !== 'reserved') {
            throw new Error("Bàn không có đặt trước");
        }
        reset(table);
    }),

    moveTable: (fromId, toId) => tx(db => {
        const { area, table: from } = find(db, fromId);
        const { table: to } = find(db, toId);
        if (!['serving', 'paying'].includes(from.status)) {
            throw new Error("Chỉ chuyển được bàn đang sử dụng");            
        }
        if (to.status !== 'empty') {
            throw new Error('Bàn đích không phải đang trống');
        }
        const cap = to.capacity + from.mergedIds.reduce((s, cid) => s + (area.tables.find(x => x.id === cid)?.capacity ?? 0), 0);
        if (from.guests > cap) {
            throw new Error(`Bàn chỉ chứa tối đa ${cap} khách`);
        }
        Object.assign(to, {
            status: from.status,
            guests: from.guests,
            startedAt: from.startedAt,
            orders: from.orders,
            mergedIds: from.mergedIds
        });
        for (const cid of to.mergedIds) {
            const c = area.tables.find(x => x.id === cid);
            if (c) {
                c.mergedInto = to.id;
            }
        }
        reset(from);
        return to;
    }),

    mergeTables: (fromId, primaryId) => tx(db => {
        const { area, table: from } = find(db, fromId);
        const { table:p } = find(db, primaryId);
        if (from.id === p.id) {
            throw new Error("Không thể gộp bàn với chính nó");
        }
        if (from.status !== 'serving') {
            throw new Error("Chỉ gộp được bàn đang phục vụ");
        }
        if (!['empty', 'serving'].includes(p.status)) {
            throw new Error("Bàn được chọn không thể gộp");
        }
        if (p.status === 'empty') {
            Object.assign(p, {
                status: 'serving',
                guests: 0,
                startedAt: from.startedAt
            });
        }
        p.guests += from.guests;
        p.startedAt = Math.min(p.startedAt, from.startedAt);
        from.orders.forEach(o => addItem(p.orders, o));
        const children = [from.id, ...from.mergedIds];
        for (const cid of children) {
            area.tables.find(x => x.id === cid).mergedInto = p.id;
        }
        p.mergedIds.push(...children);
        Object.assign(from, {
            status: 'merged',
            guests: 0,
            startedAt: null, 
            orders: [],
            mergedIds: [],
            mergedInto: p.id
        });
        return p;
    }),
    };
}

export const mockAreaService = createAreaService({
    driver: localAreaDriver,
    recordSale: async sale => revenueStore.record(sale),
});
