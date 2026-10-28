const uid = prefix => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

class HiddenInputWithLabel extends HTMLElement {
    static observedAttributes = ['label'];
    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';

        const children = [...this.childNodes];

        this.classList.add('block', 'mb-4.5');
        this.innerHTML = `
            <label class="block mb-1.5 font-semibold"></label>
            <div class="relative">
                <div data-slot></div>
            </div>
        `;
        this.labelEl = this.querySelector('label');
        this.labelEl.textContent = this.getAttribute('label') ?? '';
        this.querySelector('[data-slot]').append(...children);

        const target = children.find(n => n.nodeType === 1 &&
            (n.localName === 'hidden-input' || n.localName === 'input'));
        const isCustom = target?.localName === 'hidden-input';
        const id = this.getAttribute('id-input')
            || (isCustom ? target.getAttribute('id-input') : target?.id)
            || uid('field');

        if (target) {
            if (isCustom) target.setAttribute('id-input', id);
            else target.id = id;
        }
        this.labelEl.htmlFor = id;
    }

    attributeChangedCallback(name, _old, val) {
        if (name === 'label' && this.labelEl) this.labelEl.textContent = val ?? '';
    }
}

customElements.define('hidden-field', HiddenInputWithLabel);