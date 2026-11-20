import { esc } from '../utils/format.js';

const VARIANTS = {
    primary: 'border-primary-700 bg-primary-500 text-primary-900 shadow-sm',
    solid: 'border-primary-200 bg-white text-primary-800 hover:border-primary-400 hover:bg-primary-50',
};

class LabelButton extends HTMLElement {
    static observedAttributes = ['label', 'type', 'variant', 'disabled'];

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

    get disabled() {
        return this.hasAttribute('disabled');
    }

    set disabled(v) {
        this.toggleAttribute('disabled', Boolean(v));
    }

    render() {
        const label = this.getAttribute('label') ?? 'Label';
        const type = this.getAttribute('type') ?? 'button';
        const variant = VARIANTS[this.getAttribute('variant')] ?? VARIANTS.primary;

        this.classList.add('inline-block');
        this.innerHTML = `
        <button type="${esc(type)}" ${this.disabled ? 'disabled' : ''}
             class="rounded-xl border-2 px-3.5 py-1.5 min-h-9 cursor-pointer sr-press disabled:relative disabled:overflow-hidden disabled:border-primary-100 disabled:bg-primary-100 disabled:text-secondary-700 disabled:cursor-not-allowed disabled:after:absolute disabled:after:top-1/2 disabled:after:left-0 disabled:after:h-0.5 disabled:after:w-full disabled:after:rotate-[-20deg] disabled:after:bg-secondary-700 disabled:after:content-[''] ${variant}">
            <p class="text-xs font-bold line-clamp-1 text-ellipsis">${esc(label)}</p>
        </button>`;
    }
}

customElements.define('l-button', LabelButton);