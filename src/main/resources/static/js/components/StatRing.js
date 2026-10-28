import { ICONS } from '../icon.js';
import { esc } from '../utils/format.js';

const R = 40; //Bán kính vòng tròn
const C = 2 * Math.PI * R;

class StatRing extends HTMLElement {
    static observedAttributes = ['label', 'value', 'total', 'note', 'icon', 'format'];

    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.render();
    }

    attributeChangedCallback() {
        if (this.dataset.ready) this.render();
    }

    render() {
        const label = this.getAttribute('label') ?? '';
        const value = Number(this.getAttribute('value')) || 0;
        const total = Number(this.getAttribute('total')) || 0;
        const note = this.getAttribute('note') ?? '';
        const icon = ICONS[this.getAttribute('icon')] ?? '';
        const isMoney = this.getAttribute('format') === 'money';

        const hasTotal = total > 0;
        const ratio = total > 0 ? Math.min(value / total, 1) : 1;
        const offset = C * (1 - ratio);
        const shown = isMoney ? `${Math.round(value).toLocaleString('vi-VN')} đ` : hasTotal ? `${value}/${total}` : value;

        this.classList.add('block');
        this.innerHTML = `
        <div class="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-md">
            <div>
                <p class="text-sm font-bold text-primary-600">${esc(label)}</p>
                <p class="${isMoney ? 'text-2xl' : 'text-3xl'} font-bold text-text">${esc(shown)}</p>
                <p class="text-xs font-medium text-support-900">${esc(note)}</p>
            </div>

            <div class="relative size-20 shrink-0">
                <svg viewBox="0 0 100 100" class="size-full -rotate-90" aria-hidden="true">
                    <circle cx="50" cy="50" r="${R}" fill="none" stroke="currentColor"
                        stroke-width="10" class="text-gray-200"/>
                    <circle cx="50" cy="50" r="${R}" fill="none" stroke="currentColor"
                        stroke-width="10" stroke-linecap="round" class="text-secondary-600
                        transition-[stroke-dashoffset] duration-700"
                        stroke-dasharray="${C}" stroke-dashoffset="${offset}"/>
                </svg>
                <div class="absolute inset-0 flex items-center justify-center text-secondary-800">
                    ${icon}
                </div>
            </div>
        </div>
        `;
    }
}

customElements.define('stat-ring', StatRing);