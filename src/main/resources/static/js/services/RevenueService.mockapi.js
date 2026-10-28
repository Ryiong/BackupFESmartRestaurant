import { mockApi, mockApiList } from './MockAPIClient.js';
import { dateKey, demoDay, REVENUE_EVENT } from './RevenueStore.js';

/**
 * Doanh thu trên mockapi.io — resource `transactions`:
 *   at (Number, epoch ms) · day (String, YYYY-MM-DD) · tableName · areaName · method · total (Number)
 * Lịch sử các ngày trước hôm nay là dữ liệu mẫu sinh tại client (demoDay) để biểu đồ không trống.
 */
const RES = '/transactions';

const toTx = r => ({
    id: String(r.id),
    at: Number(r.at),
    tableName: String(r.tableName ?? ''),
    areaName: String(r.areaName ?? ''),
    method: r.method === 'transfer' ? 'transfer' : 'cash',
    total: Number(r.total) || 0,
});

export const mockApiSales = {
    async record({ tableName, areaName, method, total }) {
        const at = Date.now();
        await mockApi('POST', RES, { body: { at, day: dateKey(at), tableName, areaName, method, total } });
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(REVENUE_EVENT));
    },
};

export const mockApiRevenueService = {
    async getToday() {
        const today = dateKey();
        const sum = list => list.reduce((s, t) => s + t.total, 0);
        const transactions = (await mockApiList(RES, { day: today }))
            .filter(r => r.day === today)
            .map(toTx)
            .sort((a, b) => b.at - a.at);
        return {
            date: today,
            total: sum(transactions),
            count: transactions.length,
            cash: sum(transactions.filter(t => t.method === 'cash')),
            transfer: sum(transactions.filter(t => t.method === 'transfer')),
            transactions,
        };
    },

    async getDaily(days = 14) {
        const byDay = new Map();
        for (const r of await mockApiList(RES)) {
            const cur = byDay.get(r.day) ?? { total: 0, count: 0 };
            cur.total += Number(r.total) || 0;
            cur.count += 1;
            byDay.set(r.day, cur);
        }
        const today = dateKey();
        const now = new Date();
        const out = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const date = dateKey(d.getTime());
            const base = date === today ? { total: 0, count: 0 } : demoDay(d);
            const own = byDay.get(date) ?? { total: 0, count: 0 };
            out.push({ date, total: base.total + own.total, count: base.count + own.count });
        }
        return out;
    },

    subscribe(cb) {
        const id = setInterval(cb, 10000);
        const onVisible = () => { if (document.visibilityState === 'visible') cb(); };
        document.addEventListener('visibilitychange', onVisible);
        window.addEventListener(REVENUE_EVENT, cb);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVisible);
            window.removeEventListener(REVENUE_EVENT, cb);
        };
    },
};
