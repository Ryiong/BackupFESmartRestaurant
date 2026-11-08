import '../components/HiddenInput.js';
import '../components/InputWithLabel.js';
import '../components/PrimaryButton.js';
import { REGISTER_URL } from '../config.js';
import { http } from '../services/HttpClient.js';
import { auth } from '../services/AuthStore.js';
import { landingUrl, parseLoginQr, signInWithRefreshToken } from '../services/Session.js';

class AppLogin extends HTMLElement {
  async connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = '1';

    const qrHash = location.hash.includes('qr=') ? location.href : null;
    if (qrHash) history.replaceState(null, '', location.pathname + location.search);

    this.render();
    if (qrHash) {
      await this.qrSignIn(qrHash);
    } else if (auth.isLoggedIn() && !location.search.includes('relogin')) {
      location.replace(await landingUrl());
    }
  }

  render() {
    this.classList.add('flex', 'min-h-dvh', 'w-full', 'items-center', 'justify-center', 'px-5', 'py-8');
    this.innerHTML = `
        <div class="w-full max-w-md">
        <form id="login-form" class="w-full" novalidate>
            <h1 class="mb-2">Welcome</h1>
            <form-field id-input="login-form-username" label="Email" name="email" type="email" autocomplete="email" placeholder="example@email.com"></form-field>

            <div id="login-form__field" class="mb-4.5" data-field="">
              <label id="login-form-pw__label" for="login-form-pw" class="block mb-1.5 font-semibold">Password</label>
              <div id="login-form__pw" class="relative">
                <hidden-input id-input="login-form-pw" name="password" placeholder="Nhập mật khẩu" class="mb-1.5 text-right"></hidden-input>
              </div>
              <p id="login-form-pw__error" data-error="" role="alert" class="flex items-center gap-1.5 mt-1.5 mb-1.5 text-bug font-medium empty:hidden"></p>
            </div>
            <button id="login-form__submit" type="submit" class="w-full min-h-12.5 border rounded-xl bg-primary-700 text-white font-bold cursor-pointer shadow-[0_8px_20px_-8px_rgba(20,83,45,.6)] hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700">Đăng nhập</button>
          <div id="login-form__live" role="status" aria-live="polite" data-live=""></div>
        </form>
        <button id="login-qr" type="button" class="mt-3 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-primary-100 bg-white font-bold text-primary-600 hover:border-primary-600">
          Quét QR đăng nhập
        </button>
        <p id="login-form__foot" class="mt-6 text-text text-center">Chưa có tài khoản? <a id="login-form__link" href="${REGISTER_URL}" class="text-primary-600 font-medium no-underline rounded-sm">Tạo tài khoản</a></p>
        </div>
      `;
    this.form = this.querySelector('#login-form');
    this.error = this.querySelector('[data-error]');
    this.submitBtn = this.querySelector('#login-form__submit');
    this.form.addEventListener('submit', e => this.onSubmit(e));
    this.querySelector('#login-qr').addEventListener('click', () => this.scan());
  }

  async scan() {
    const { scanQrDialog } = await import('../utils/qrScanDialog.js');
    const token = await scanQrDialog({
      title: 'Quét QR đăng nhập',
      hint: 'Quét mã QR đang hiện trên thiết bị đã đăng nhập.',
      accept: parseLoginQr,
    });
    if (token) await this.qrSignIn(token);
  }

  async qrSignIn(source) {
    this.setError('');
    this.submitBtn.disabled = true;
    try {
      const token = source.startsWith('http') ? parseLoginQr(source) : source;
      await signInWithRefreshToken(token);
      location.replace(await landingUrl());
    } catch (err) {
      this.setError(err.message);
      this.submitBtn.disabled = false;
    }
  }

  async onSubmit(e) {
    e.preventDefault();
    this.setError('');
    this.submitBtn.disabled = true;

    const data = Object.fromEntries(new FormData(this.form));

    try {
      const res = await http('POST', '/auth/login', { email: data.email?.trim(), password: data.password }, { auth: false });
      auth.save(res);
      location.replace(await landingUrl());
    }
    catch (err) {
      this.setError(err.message);
      this.submitBtn.disabled = false;
    }
  }

  setError(msg) {
    this.error.textContent = msg;
    this.error.classList.toggle('hidden', !msg);
  }
}

customElements.define('app-login', AppLogin);