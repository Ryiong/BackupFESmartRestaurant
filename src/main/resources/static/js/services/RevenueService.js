import { API_MODE } from '../config.js';
import { springRevenue } from './RevenueService.spring.js';
import { revenueStore, dateKey, REVENUE_EVENT } from './RevenueStore.js';

const wait = (ms = 80) => new Promise(r => setTimeout(r, ms));

const localRevenueService = {
    async getToday() {
        await wait();
        const today = dateKey();
        const transactions = revenueStore.snapshot().txs
            .filter(t => dateKey(t.at) === today)
            .sort((a, b) => b.at - a.at);
        const sum = list => list.reduce((s, t) => s + t.total, 0);
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
        await wait();
        const { daily, txs } = revenueStore.snapshot();
        const out = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const date = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).getTime());
            const base = daily[date] ?? { total: 0, count: 0 };
            const own = txs.filter(t => dateKey(t.at) === date);
            out.push({ date, total: base.total + own.reduce((s, t) => s + t.total, 0), count: base.count + own.length });
        }
        return out;
    },

    subscribe(cb) {
        const onStorage = e => { if (e.key === revenueStore.key) cb(); };
        window.addEventListener('storage', onStorage);
        window.addEventListener(REVENUE_EVENT, cb);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener(REVENUE_EVENT, cb);
        };
    },
};

const springRevenueService = {
    getToday: () => springRevenue.getToday(),
    getDaily: days => springRevenue.getDaily(days),
    subscribe(cb) {
        const id = setInterval(cb, 30000);
        return () => clearInterval(id);
    },
};

const SERVICES = { local: localRevenueService, spring: springRevenueService };

export const revenueService = SERVICES[API_MODE] ?? localRevenueService;
