/** This file is for design purpose only
 Data: {
    daily: {
        'YYYY-MM-DD': {
            total,
            count
        }
    }, //Lịch sử các ngày trước demo data
    txs: [{
        id,
        at,
        tableName,
        areaName,
        method,
        total
    }] // hoá đơn phát sinh khi demo
 }
*/

const KEY = 'sr:revenue:v1';
export const REVENUE_EVENT = 'revenue:changed';

const pad = n => String(n).padStart(2, '0');
export const dateKey = (ts = Date.now()) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function demoDay(d) {
    const n = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    const r = Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
    const weekend = [0, 5, 6].includes(d.getDay()) ? 1.3 : 1;
    const total = Math.round(((2 + r * 7) * weekend * 1e6) / 1e4) * 1e4;
    return { total, count: Math.max(5, Math.round(total / 260000)) };
}

function seed() {
    const daily = {};
    const now = new Date();
    for (let i = 1; i <= 45; i++) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        daily[dateKey(d.getTime())] = demoDay(d);
    }
    return { daily, txs: [] };
}

function load() {
    try {
        const raw = JSON.parse(localStorage.getItem(KEY));
        if (raw && typeof raw.daily === 'object' && Array.isArray(raw.txs)) {
            return raw;
        }
    }
    catch { }
    const db = seed();
    save(db, false);
    return db;
}

function save(db, notify = true) {
    try {
        localStorage.setItem( KEY, JSON.stringify(db));
    }
    catch { }
    if (notify && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(REVENUE_EVENT));
    }
}

export const revenueStore = {
    key: KEY,
    snapshot: () => load(),

    record({ tableName, areaName, method, total }) {
        const db = load();
        const tx = {
            id: `tx-${crypto.randomUUID().slice(0, 8)}`,
            at: Date.now(),
            tableName,
            areaName,
            method, 
            total
        };
        db.txs.push(tx);
        save(db);
        return tx;
    },

    reset() {
        save(seed());
    },
}