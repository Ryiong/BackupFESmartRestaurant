import { ICONS } from '../icon.js';
const uid = prefix => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

class HiddenInput extends HTMLElement {
  static observedAttributes = ['placeholder', 'id-input', 'name', 'autocomplete'];

  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = '1';

    this.classList.add('block', 'relative');
    this.innerHTML = `
        <input type="password" required minlength="8" class="block w-full min-w-12 pt-2.5 pb-2.5 pl-3.5 pr-3.5 border-solid border border-support-600 rounded-xl bg-white text-text transition-border duration-200 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
        <button type="button" aria-pressed="false" class="absolute top-1 right-1 grid place-items-center w-10 h-10 border-0 rounded-lg bg-transparent text-support-900 cursor-pointer">
            ${ICONS.eye}
        </button>`;

    this.input = this.querySelector('input');
    this.button = this.querySelector('button');
    this._autoId = uid('pw');
    this.button.setAttribute('aria-label', 'Hiện mật khẩu');
    this.button.addEventListener('click', () => this.toggle());
    this.sync();
  }

  attributeChangedCallback() {
    if (this.input) this.sync();
  }

  sync() {
    const id = this.getAttribute('id-input') || this._autoId;
    this.input.id = id;
    this.button.setAttribute('aria-controls', id);
    this.input.name = this.getAttribute('name') ?? 'password';
    this.input.placeholder = this.getAttribute('placeholder') ?? '';
    this.input.autocomplete = this.getAttribute('autocomplete') ?? 'current-password';
  }

  toggle(show = this.input.type === 'password') {
    this.input.type = show ? 'text' : 'password';
    this.button.innerHTML = show ? ICONS.eyeOff : ICONS.eye;
    this.button.setAttribute('aria-pressed', String(show));
    this.button.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');

    this.dispatchEvent(new CustomEvent('visibility-change', {
      bubbles: true,
      detail: { visible: show },
    }));
  }
  
  get inputId() { return this.input?.id ?? ''; }
  get value() { return this.input?.value ?? ''; }
  set value(v) { if (this.input) this.input.value = v; }

}

customElements.define('hidden-input', HiddenInput);