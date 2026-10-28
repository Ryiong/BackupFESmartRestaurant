import { esc } from '../utils/format.js';

const pad = n => String(n).padStart(2, '0');
const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

class RevenueChart extends HTMLElement {
    static observedAttributes = ['month', 'days', 'title', 'unit', 'href'];
    #data = [];

    get data() { return this.#data }
    set data(v) {
        this.#data = v ?? [];
        if (this.dataset.ready) this.render();
    }

    connectedCallback() {
        if (Object.hasOwn(this, 'data')) {
            const v = this.data;
            delete this.data;
            this.#data = v ?? [];
        }
        if (this.dataset.ready) return;
        this.dataset.ready = '1';

        this.classList.add('mb-8')
        this.render();
    }

    attributeChangedCallback() { if (this.dataset.ready) this.render(); }

    #rows() {
        const map = new Map(this.#data.map(d => [d.date, d.value]));
        const month = this.getAttribute('month');
        const rows = [];

        if (month) {
            const [y, m] = month.split('-').map(Number);
            const n = new Date(y, m, 0).getDate();
            for (let d = 1; d <= n; d++) {
                const k = `${month}-${pad(d)}`;
                rows.push({ label: String(d), date: k, value: map.get(k) ?? 0 });
            }
        } else {
            const n = Number(this.getAttribute('days')) || 14;
            const today = new Date();
            for (let i = n - 1; i >= 0; i--) {
                const dt = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
                const k = key(dt);
                rows.push({ label: `${dt.getDate()}/${dt.getMonth() + 1}`, date: k, value: map.get(k) ?? 0 });
            }
        }
        return rows;
    }

    render() {
        const title = this.getAttribute('title') ?? '';
        const unit = this.getAttribute('unit') ?? '';
        const href = this.getAttribute('href') ?? '#';
        const rows = this.#rows();

        const maxVal = Math.max(...this.#data.map(d => d.value), 1);
        const step = Math.max(1, Math.ceil(maxVal / 5));
        const top = Math.ceil(maxVal / step) * step;
        const ticks = Array.from(
            { length: top / step + 1 },
            (_, i) => top - i * step
        );

        const barW = rows.length > 20 ? 'w-1.5' : 'w-3';
        const every = rows.length > 20 ? 5 : rows.length > 10 ? 2 : 1;

        const grid = ticks.map(t => `
            <div class="flex items-center gap-2">
                <span class="w-6 text-right text-sm text-primary-700">${t}</span>
                <div class="h-px flex-1 bg-gray-200"></div>
            </div>`).join('');

        const bars = rows.map(r => `
            <div class="flex h-full flex-1 items-end justify-center"
                title="${esc(r.date)}: ${r.value} ${esc(unit)}">
                <div class="${barW} rounded-t ${r.value ? 'bg-primary-700' : 'bg-gray-200'} transition-all duration-500"
                    style="height:${r.value ? Math.max((r.value / top) * 100, 1) : 1}%"></div>
            </div>`).join('');

        const labels = rows.map((r, i) => `
            <span class="flex-1 whitespace-nowrap text-center text-xs text-primary-700">
                ${i % every === 0 || i === rows.length - 1 ? esc(r.label) : ''}
            </span>`).join('');

        this.classList.add('block');

        this.innerHTML = `
        <section class="rounded-2xl bg-white p-4 shadow-md">
            <header class="mb-2 flex items-center justify-between">
                <h2 class="text-lg font-extrabold text-primary-700">${esc(title)}</h2>
                <a href="${esc(href)}" class="font-semibold text-primary-700 hover:underline">Xem chi tiết &gt;&gt;</a>
            </header>
            <div class="relative">
                <div class="flex h-44 flex-col justify-between">${grid}</div>
                <div class="absolute inset-y-0 right-0 left-8 flex">${bars}</div>
            </div>
            <div class="mt-1 flex pl-8">${labels}</div>
            <p class="mt-1 text-sm text-primary-700">${esc(unit)}</p>
        </section>`;
    }
}

customElements.define('revenue-chart', RevenueChart);