const uid = prefix => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

class InputAndLabel extends HTMLElement {
  static observedAttributes = ['label', 'name', 'placeholder', 'id-input', 'type', 'autocomplete'];

  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = '1';

    this.classList.add('block', 'mb-4.5');
    this.innerHTML = `
    <label class="block mb-1.5 font-semibold"></label>
    <input required class="block w-full min-w-12 pt-2.5 pb-2.5 pl-3.5 pr-3.5 border-solid border border-support-600 rounded-xl bg-white text-text transition-border duration-200 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
    `;

    this.labelEl = this.querySelector('label');
    this.input = this.querySelector('input');
    this._autoId = uid('field');
    this.sync();
  }

  attributeChangedCallback() {
    if (this.input) this.sync();
  }

  sync() {
    const id = this.getAttribute('id-input') || this._autoId;
    this.input.id = id;
    this.labelEl.htmlFor = id;
    this.labelEl.textContent = this.getAttribute('label') ?? 'Label Input';
    this.input.name = this.getAttribute('name') ?? 'password';
    this.input.placeholder = this.getAttribute('placeholder') ?? '';
    this.input.type = this.getAttribute('type') ?? 'text';
    this.input.autocomplete = this.getAttribute('autocomplete') ?? 'username';
  }

  get value() { return this.input?.value ?? ''; }
  set value(v) { if (this.input) this.input.value = v; }
}

customElements.define('form-field', InputAndLabel);
