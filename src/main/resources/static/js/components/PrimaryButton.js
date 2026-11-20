import { ICONS } from '../icon.js';
import { esc } from '../utils/format.js';

const VARIANTS = {
    primary: 'border-primary-300 bg-white text-text hover:border-primary-400',
    danger: 'border-danger-bd text-danger-fg hover:border-danger-fg bg-white',
    solid: 'border-primary-500 bg-primary-500 text-primary-900 hover:bg-primary-400',
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

        this.innerHTML = `
        <button type="${esc(type)}" ${this.disabled ? 'disabled' : ''}
            class="sr-press flex w-full min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3.5 py-2 md:min-h-10
            disabled:cursor-not-allowed disabled:opacity-50 ${variant}">
                ${icon}
            <span class="text-sm font-bold">${esc(label)}</span>
        </button>`;
    }
}


customElements.define('p-button', PrimaryButton);