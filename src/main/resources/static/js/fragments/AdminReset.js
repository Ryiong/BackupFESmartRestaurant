import '../components/InputWithLabel.js';
import { LOGIN_URL } from '../config.js';
import { http } from '../services/HttpClient.js';

class AppReset extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = '1';

    this.classList.add("w-screen", "flex", "justify-center", "items-center", "h-screen");
    this.innerHTML = `
        <form id="login-form" class="min-w-md">
            <h1 class="mb-2">Lấy lại mật khẩu</h1>
            <form-field label="Email" name="email" type="email" autocomplete="email" placeholder="example@email.com"></form-field>
            
            <p id="login-form__error" data-error="" class="flex items-center gap-1.5 mt-1.5 mb-.5 text-bug font-medium empty:hidden"></p>
          <button id="login-form__submit" type="submit" class="w-full min-h-12.5 border rounded-xl bg-primary-700 text-white font-bold cursor-pointer shadow-[0_8px_20px_-8px_rgba(20,83,45,.6)] hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700">Gửi yêu cầu</button>
          <div id="login-form__live" role="status" aria-live="polite" data-live=""></div>
          <p id="login-form__foot" class="mt-6 text-text text-center">Quay lại trang <a id="login-form__link" href="/auth/login.html" class="text-primary-600 font-medium no-underline hover:underline hover:underline-offset- rounded-sm">ĐĂNG NHẬP</a></p>
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
      // POST /auth/resend-otp — @RequestBody String email → gửi email thô (text/plain), KHÔNG phải JSON {email}
      await http('POST', '/auth/resend-otp', data.email?.trim(), { auth: false, text: true });
      location.href = LOGIN_URL;
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

customElements.define('app-reset', AppReset);