import './AdminNavigation.js';
import './AdminHeader.js';
import '../components/StatRing.js';
import '../components/RevenueChart.js';
import '../components/PrimaryButton.js';
import { API_MODE, NO_CONTENT } from '../config.js';
import { revenueService } from '../services/RevenueService.js';
import { getTableStats, getProductStats } from '../services/DashboardService.js';
import { listShops, getCurrentShop, setCurrentShopId, onShopChange, STATUS_LABEL } from '../services/ShopService.js';
import { shopCreateDialog, shopEditDialog } from './ShopDialogs.js';
import { esc, titleCase } from '../utils/format.js';

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
const hhmm = t => (t ? String(t).slice(0, 5) : '');

function renderShopBar(shops, current) {
    const status = STATUS_LABEL[current.status];
    const hours = current.openTime && current.closeTime ? `${hhmm(current.openTime)} – ${hhmm(current.closeTime)}` : '';
    const meta = [current.address, hours].filter(Boolean).join(' - ');
    const note = current.status === 'LOCKED' && current.statusReason
        ? `<p class="text-xs font-semibold text-red-700">Lý do khoá: ${esc(current.statusReason)}</p>`
        : current.status === 'PENDING'
            ? '<p class="text-xs text-support-900">Quản trị viên đang xem xét cửa hàng của bạn</p>'
            : '';
    el.bar.innerHTML = `
        <div class="flex min-w-0 flex-1 flex-col gap-1 md:basis-60">
            <div class="flex flex-wrap items-center gap-2.5">
                ${shops.length > 1
            ? `<label class="sr-only" for="shop-select">Cửa hàng</label>
                       <select id="shop-select" class="max-w-full rounded-xl border border-support-600 bg-white px-3 py-2 font-semibold text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                           ${shops.map(s => `<option value="${esc(s.id)}" ${s.id === current.id ? 'selected' : ''}>${esc(titleCase(s.name))}</option>`).join('')}
                       </select>`
            : `<h2 class="min-w-0 truncate text-lg font-bold text-text">${esc(titleCase(current.name))}</h2>`}
                ${status ? `<span class="shrink-0 rounded-full px-3 py-1 text-xs font-bold ${status.cls}">${status.text}</span>` : ''}
            </div>
            ${meta ? `<p class="text-sm text-support-900">${esc(meta)}</p>` : ''}
            ${note}
        </div>
        <div class="btn-row">
            <p-button id="shop-edit" label="Sửa cửa hàng" icon="edit" ${current.status !== 'ACTIVE' ? 'disabled title="Chỉ sửa được sau khi quản trị viên duyệt cửa hàng"' : ''}></p-button>
            <p-button id="shop-create" label="Tạo cửa hàng" icon="add" variant="solid"></p-button>
        </div>`;
        
    el.bar.querySelector('#shop-select')?.addEventListener('change', e => setCurrentShopId(e.target.value));
    el.bar.querySelector('#shop-edit').addEventListener('click', () => { if (current.status === 'ACTIVE') shopEditDialog(current); });
    el.bar.querySelector('#shop-create').addEventListener('click', createShopFlow);
}

const fail = (node, what, err) => set(node, { note: err?.noAccess ? NO_CONTENT : `Không tải được ${what}` });

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
            if (r.status === 'rejected') { fail(jobs[i][1], jobs[i][2], r.reason); if (!r.reason?.noAccess) errors.push(r.reason?.message); }
        });
        el.error.hidden = !errors.length;
        el.error.textContent = errors.length ? [...new Set(errors)].join(' · ') : '';
    } finally {
        loading = false;
        if (again) { again = false; refresh(); }
    }
}

/** Cửa hàng chưa được quản trị viên cho phép hoạt động: tắt toàn bộ tính năng, chỉ báo "đang chờ duyệt" hoặc lý do bị từ chối/khoá. */
function renderGate(shop) {
    let box = document.getElementById('shop-gate');
    if (shop.status === 'ACTIVE') { box?.remove(); return false; }
    if (!box) {
        box = document.createElement('div');
        box.id = 'shop-gate';
        el.bar.after(box);
    }
    const reason = String(shop.statusReason ?? '').trim();
    const locked = shop.status === 'LOCKED';
    // Backend giữ trạng thái chờ duyệt khi từ chối và chỉ ghi lý do, nên PENDING kèm lý do nghĩa là bị từ chối duyệt.
    const [tone, title, text] = locked
        ? ['red', 'Cửa hàng đã bị khoá', 'Toàn bộ chức năng (đặt bàn, thực đơn, kho…) đang tạm tắt.']
        : reason
            ? ['red', 'Cửa hàng bị từ chối duyệt', 'Toàn bộ chức năng đang tắt. Hãy chỉnh lại thông tin theo lý do dưới đây rồi liên hệ quản trị viên để được xem xét lại.']
            : ['amber', 'Đang chờ duyệt', 'Cửa hàng chỉ hoạt động sau khi quản trị viên cho phép. Toàn bộ chức năng (đặt bàn, thực đơn, kho…) sẽ mở sau khi được duyệt.'];
    box.className = `mx-4 my-4 rounded-2xl border-2 p-5 md:mx-5 ${tone === 'red' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`;
    box.setAttribute('role', 'status');
    box.innerHTML = `<p class="text-base font-bold">${title}</p><p class="mt-1 text-sm">${text}</p>
        ${reason ? `<p class="mt-3 rounded-lg bg-white/70 p-3 text-sm"><b>Lý do:</b> ${esc(reason)}</p>` : ''}`;
    el.onboarding.hidden = true;
    el.dashboard.hidden = true;
    return true;
}

async function init() {
    if (SPRING) {
        let shops;
        try { shops = await listShops({ force: true }); }
        catch (err) {
            if (err.noAccess) { el.bar.innerHTML = ''; el.dashboard.hidden = true; el.error.hidden = false; el.error.className = 'mx-5 mb-4 py-16 text-center text-sm font-semibold text-secondary-700'; el.error.textContent = NO_CONTENT; return; }
            el.error.hidden = false; el.error.textContent = err.message; el.dashboard.hidden = false; return;
        }

        if (!shops.length) {
            el.bar.innerHTML = '';
            el.dashboard.hidden = true;
            el.onboarding.hidden = false;
            return;
        }
        const cur = await getCurrentShop();
        renderShopBar(shops, cur);
        if (renderGate(cur)) return;
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
