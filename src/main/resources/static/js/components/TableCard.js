import { ICONS } from '../icon.js';
import { esc, STATUS } from '../utils/format.js';

class TableCard extends HTMLElement {
    static observedAttributes = [
        'name',
        'capacity',
        'status',
        'variant',
        'selected',
        'disabled',
        'note'
    ];

    connectedCallback() {
        this.classList.add('block', 'cursor-pointer');
        if (!this._bound) {
            this._bound = true;
            this.addEventListener('keydown', e => {
                if ((e.key === 'Enter' || e.key === ' ')
                && e.target.matches('[role="button"]')) {
                    e.preventDefault();
                    this.click();
                }
            });
        }
        this.render();
    }

    attributeChangedCallback() {
        if (this.isConnected) this.render();
    }

    render() {
        const name = esc(this.getAttribute('name') ?? '');
        const capacity = esc(this.getAttribute('capacity') ?? '0');
        const status = STATUS[this.getAttribute('status')] ? this.getAttribute('status') : 'empty';
        const variant = this.getAttribute('variant') ?? 'view';
        const selected = this.hasAttribute('selected');
        const disabled = this.hasAttribute('disabled');
        const note = this.getAttribute('note');
        const st = STATUS[status];

        const interactive = variant !== 'edit';
        const base = 'rounded-2xl border-2 p-3 transition-all ' + 
            (disabled ? 'cursor-not-allowed opacity-40' : interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md ' : '');
        const look = variant === 'view' ? st.card : 'border-primary-200 bg-white ';
        const sel = selected ? 'ring-4 ring-primary-300 border-primary-700' : '';
        const a11y = interactive
            ? `role="button" tabindex="${disabled ? -1 : 0}" aria-pressed="${selected}" aria-disabled="${disabled}"`
            : '';
        if (note && disabled) {
            this.title = note;
        } else {
            this.removeAttribute('title');
        }

        let footer = '';
        if (variant === 'view') {
            footer = `
                <span class="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${st.badge}">
                    ${esc(note || st.label)}
                </span>
            `;
        } else if (variant === 'pick') {
            footer = `
                <span class="mt-2 inline-block rounded-full px-2 py-0.5 font-bold ${st.badge}">
                    ${st.label}
                </span>
            `;
        } else {
            const key = esc(this.dataset.key ?? '');
            footer = `
                <div class="mt-2 flex gap-1.5">
                    <button type="button" data-act="edit-table" data-key="${key}" aria-label="Sửa ${name}"
                        class="flex h-6 w-10 cursor-pointer items-center justify-center rounded bg-primary-700 text-white transition-all hover:scale-95 hover:bg-primary-800">
                        ${ICONS.edit}
                    </button> 
                    <button type="button" data-act="delete-table" data-key="${key}" aria-label="Xoá ${name}"
                        class="flex h-6 w-10 cursor-pointer items-center justify-center rounded bg-red-400 text-white transition-all hover:scale-95 hover:bg-red-500">
                        ${ICONS.delete}
                    </button>
                </div>
            `;
        }

        this.innerHTML = `
            <div ${a11y} class="${base}${look}${sel}">
                <p class="line-clamp-1 text-sm font-bold text-text">
                    ${name}
                </p>
                <p class="mt-0.5 text-xs text-secondary-700">
                    Sức chứa: ${capacity} khách
                </p>
                ${footer}
            </div>
        `;
    }
}

customElements.define('table-card', TableCard);