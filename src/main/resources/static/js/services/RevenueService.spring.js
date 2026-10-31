import { http } from './HttpClient.js';
import { getShopId } from './AreaService.spring.js';

const key = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sum = list => list.reduce((s, t) => s + t.total, 0);

const cache = new Map(); // dateKey → { at, promise }
const TTL = 15000;
function paidOrders(shopId, date) {
    const k = key(date);
    const hit = cache.get(k);
    if (hit && Date.now() - hit.at < TTL) return hit.promise;
    const promise = http('GET', `/order/${shopId}`, undefined, { query: { date: k } })
        .then(list => (list ?? []).filter(o => o.orderStatus === 'PAID' || o.paymentStatus === 'PAID'))
        .catch(err => { cache.delete(k); throw err; });
    cache.set(k, { at: Date.now(), promise });
    return promise;
}

const toTx = o => ({
    id: String(o.id),
    at: o.paidAt ? Date.parse(o.paidAt) : Date.now(),
    tableName: o.table?.name ?? '',
    areaName: '',
    method: o.paymentMethod === 'BANKING' ? 'transfer' : 'cash',
    total: Number(o.totalPrice) || 0,
});

export const springRevenue = {
    async getToday() {
        const now = new Date();
        const transactions = (await paidOrders(await getShopId(), now)).map(toTx).sort((a, b) => b.at - a.at);
        return {
            date: key(now),
            total: sum(transactions),
            count: transactions.length,
            cash: sum(transactions.filter(t => t.method === 'cash')),
            transfer: sum(transactions.filter(t => t.method === 'transfer')),
            transactions,
        };
    },

    async getDaily(days = 14) {
        const shopId = await getShopId();
        const now = new Date();
        const dates = Array.from({ length: days }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i)));
        const lists = await Promise.all(dates.map(d => paidOrders(shopId, d)));
        return dates.map((d, i) => {
            const txs = lists[i].map(toTx);
            return { date: key(d), total: sum(txs), count: txs.length };
        });
    },
};
