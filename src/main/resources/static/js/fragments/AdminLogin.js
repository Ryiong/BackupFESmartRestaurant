import '../components/HiddenInput.js';
import '../components/InputWithLabel.js';
import { ADMIN_URL, LOGIN_URL } from '../config.js';
import { http } from '../services/HttpClient.js';
import { auth } from '../services/AuthStore.js';

class AppLogin extends HTMLElement {
  connectedCallback() {
    if (auth.isLoggedIn() && !location.search.includes('relogin')) { location.replace(ADMIN_URL); return; }
    if (this.dataset.ready) return;
    this.dataset.ready = '1';

    this.classList.add("w-screen", "flex", "justify-center", "items-center", "h-screen");
    this.innerHTML = `
        <form id="login-form" class="min-w-md">
            <h1 class="mb-2 ">Welcome</h1>
            <form-field id-input="login-form-username" label="Email" name="email" type="email" autocomplete="email" placeholder="example@email.com"></form-field>
            
            <div id="login-form__field" class="mb-4.5" data-field="">
              <label id="login-form-pw__label" for="login-form-pw" class="block mb-1.5 font-semibold">Password</label>
              <div id="login-form__pw" class="relative">
                <hidden-input id-input="login-form-pw" name="password" placeholder="Nhập mật khẩu" class="mb-1.5 text-right"></hidden-input>
              </div>
              <!--<div class="mb-1.5 text-right">
                <a id="login-form-pw__link" href="/auth/reset.html" class="font-medium text-primary-600 rounded-sm no-underline hover:underline hover:underline-offset-3">Forgot password?</a>
              </div>-->
              <p id="login-form-pw__error" data-error="" class="flex items-center gap-1.5 mt-1.5 mb-1.5 text-bug font-medium empty:hidden"></p>
            </div>
            <button id="login-form__submit" type="submit" class="w-full min-h-12.5 border rounded-xl bg-primary-700 text-white font-bold cursor-pointer shadow-[0_8px_20px_-8px_rgba(20,83,45,.6)] hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700">Đăng nhập</button>
          <div id="login-form__live" role="status" aria-live="polite" data-live=""></div>
          <p id="login-form__foot" class="mt-6 text-text text-center">Chưa có tài khoản? <a id="login-form__link" href="/auth/register.html" class="text-primary-600 font-medium no-underline rounded-sm">Tạo tài khoản</a></p>
        </form>
      `;
    this.form = this.querySelector('#login-form');
    this.error = this.querySelector('[data-error]');
    this.submitBtn = this.querySelector('#login-form__submit');

    this.form.addEventListener('submit', e => this.onSubmit(e));
  }

  async onSubmit(e) {
    e.preventDefault();
    this.setError('');
    this.submitBtn.disabled = true;

    const data = Object.fromEntries(new FormData(this.form));

    try {
      // POST /smart-restaurant/v1/auth/login  {email, password} → LoginResponse{accessToken, refreshToken, ...}
      const res = await http('POST', '/auth/login', { email: data.email?.trim(), password: data.password }, { auth: false });
      auth.save(res);
      location.href = ADMIN_URL;
    }
    catch (err) {
      this.setError(err.message);
    } finally {
      this.submitBtn.disabled = false;
    }
  }

  setError(msg) {
    this.error.textContent = msg;
    this.error.classList.toggle('hidden', !msg);
  }
}

customElements.define('app-login', AppLogin);