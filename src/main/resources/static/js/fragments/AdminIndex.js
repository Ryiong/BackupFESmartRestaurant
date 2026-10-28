import './AdminNavigation.js';
import './AdminHeader.js';
import '../components/StatRing.js';
import '../components/RevenueChart.js';
import '../components/PrimaryButton.js';
import { API_MODE } from '../config.js';
import { revenueService } from '../services/RevenueService.js';
import { getTableStats, getProductStats } from '../services/DashboardService.js';
import { listShops, getCurrentShop, setCurrentShopId, onShopChange, STATUS_LABEL } from '../services/ShopService.js';
import { shopCreateDialog } from './ShopDialogs.js';
import { esc } from '../utils/format.js';

const $ = sel => document.querySelector(sel);
const el = {
    bar: $('#shop-bar'),
    onboarding: $('#onboarding'),
    dashboard: $('#dashboard'),
    error: $('#load-error'),
    revenue: $('#stat-revenue-today'),
    tables: $('#stat-tables'),
    products: $('#stat-products'),
    chartDays: $('#revenue-chart-days'),
    chartMonth: $('#revenue-chart-month'),
};

const SPRING = API_MODE === 'spring';
const REFRESH_MS = 30000;
const toMillion = vnd => Math.round(vnd / 1e4) / 100;
const set = (node, attrs) => Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));

const createShopFlow = () => shopCreateDialog();

function renderShopBar(shops, current) {
    const status = STATUS_LABEL[current.status];
    el.bar.innerHTML = `
        ${shops.length > 1
            ? `<label class="sr-only" for="shop-select">Cửa hàng</label>
               <select id="shop-select" class="rounded-xl border border-support-600 bg-white px-3 py-2 font-semibold text-text">
                   ${shops.map(s => `<option value="${esc(s.id)}" ${s.id === current.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
               </select>`
            : `<h2 class="text-lg font-bold text-text">${esc(current.name)}</h2>`}
        ${status ? `<span class="rounded-full px-3 py-1 text-xs font-bold ${status.cls}">${status.text}</span>` : ''}
        ${current.status === 'LOCKED' && current.statusReason ? `<span class="text-xs text-red-700">Lý do: ${esc(current.statusReason)}</span>` : ''}
        ${current.status === 'PENDING' ? '<span class="text-xs text-support-900">Quản trị viên đang xem xét cửa hàng của bạn</span>' : ''}
        <span class="ml-auto"></span>
        <p-button id="shop-create" label="Tạo cửa hàng" icon="add"></p-button>`;
    el.bar.querySelector('#shop-select')?.addEventListener('change', e => setCurrentShopId(e.target.value));
    el.bar.querySelector('#shop-create').addEventListener('click', createShopFlow);
}

const fail = (node, what) => set(node, { note: `Không tải được ${what}` });

async function loadRevenue() {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    el.chartMonth.setAttribute('month', ym);
    el.chartMonth.setAttribute('title', `Doanh thu tháng ${now.getMonth() + 1}`);

    const days = Math.max(14, now.getDate());
    const [today, daily] = await Promise.all([revenueService.getToday(), revenueService.getDaily(days)]);

    const yesterday = daily.at(-2)?.total ?? 0;
    let note = today.count ? `${today.count} hoá đơn hôm nay` : 'Chưa có hoá đơn hôm nay';
    if (yesterday > 0 && today.total > 0) {
        const pct = Math.round((today.total - yesterday) / yesterday * 100);
        note += ` · ${pct >= 0 ? '+' : ''}${pct}% so với hôm qua`;
    }
    set(el.revenue, { value: today.total, note });

    const points = daily.map(d => ({ date: d.date, value: toMillion(d.total) }));
    el.chartDays.data = points;
    el.chartMonth.data = points;
}

async function loadTables() {
    const t = await getTableStats();
    set(el.tables, {
        value: t.busy,
        total: t.total,
        note: t.total ? `${t.empty} bàn trống${t.pausedAreas ? ` · ${t.pausedAreas} khu vực tạm ngưng` : ''}` : 'Chưa có bàn nào',
    });
}

async function loadProducts() {
    const p = await getProductStats();
    set(el.products, {
        value: p.active,
        total: p.total,
        note: p.total ? (p.total > p.active ? `${p.total - p.active} món tạm ngưng` : 'Tất cả món đang bán') : 'Chưa có món nào',
    });
}

let loading = false, again = false;
async function refresh() {
    if (loading) { again = true; return; }
    loading = true;
    try {
        const jobs = [
            [loadRevenue, el.revenue, 'doanh thu'],
            [loadTables, el.tables, 'số bàn'],
            [loadProducts, el.products, 'thực đơn'],
        ];
        const results = await Promise.allSettled(jobs.map(([fn]) => fn()));
        const errors = [];
        results.forEach((r, i) => {
            if (r.status === 'rejected') { fail(jobs[i][1], jobs[i][2]); errors.push(r.reason?.message); }
        });
        el.error.hidden = !errors.length;
        el.error.textContent = errors.length ? [...new Set(errors)].join(' · ') : '';
    } finally {
        loading = false;
        if (again) { again = false; refresh(); }
    }
}

async function init() {
    if (SPRING) {
        let shops;
        try { shops = await listShops({ force: true }); }
        catch (err) { el.error.hidden = false; el.error.textContent = err.message; el.dashboard.hidden = false; return; }

        if (!shops.length) {
            el.bar.innerHTML = '';
            el.dashboard.hidden = true;
            el.onboarding.hidden = false;
            return;
        }
        renderShopBar(shops, await getCurrentShop());
    }
    el.onboarding.hidden = true;
    el.dashboard.hidden = false;
    refresh();
}

$('#onboarding-create').addEventListener('click', createShopFlow);
onShopChange(() => init());

revenueService.subscribe(() => { if (!document.hidden) refresh(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !el.dashboard.hidden) refresh(); });

init();
