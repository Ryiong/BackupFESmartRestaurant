import { ICONS } from '../icon.js';
import { esc } from '../utils/format.js';

const VARIANTS = {
    primary: 'border-primary-100 text-primary-500 hover:border-primary-600 bg-white',
    danger: 'border-red-200 text-red-500 hover:border-red-500 bg-white',
    solid: 'border-primary-700 bg-primary-700 text-white hover:bg-primary-800',
};

class PrimaryButton extends HTMLElement {
    static observedAttributes = ['label', 'icon', 'variant', 'type', 'disabled'];

    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';

        this.addEventListener('click', e => {
            if (this.hasAttribute('disabled')) { e.stopImmediatePropagation(); e.preventDefault(); }
        }, true);

        this.render();
    }

    attributeChangedCallback() {
        if (this.dataset.ready) this.render();
    }

    get disabled() { return this.hasAttribute('disabled'); }
    set disabled(v) { this.toggleAttribute('disabled', Boolean(v)); }

    render() {
        const label = this.getAttribute('label') ?? 'Button';
        const icon = ICONS[this.getAttribute('icon')] ?? '';
        const type = this.getAttribute('type') ?? 'button'; 
        const variant = VARIANTS[this.getAttribute('variant')] ?? VARIANTS.primary;

        this.classList.add('inline-block');
        this.innerHTML = `
        <button type="${esc(type)}" ${this.disabled ? 'disabled' : ''}
            class="flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3.5 py-2 transition-all
                hover:scale-95 disabled:cursor-not-allowed disabled:opacity-50
                disabled:hover:scale-100 ${variant}">
                ${icon}
            <span class="text-sm font-bold">${esc(label)}</span>
        </button>`;
    }
}


customElements.define('p-button', PrimaryButton);