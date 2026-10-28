import '../components/InputWithLabel.js';
import '../components/HiddenInput.js';
import '../components/HiddenInputWithLabel.js';
import { LOGIN_URL } from '../config.js';
import { http } from '../services/HttpClient.js';

const BTN = 'w-full min-h-12.5 border rounded-xl bg-primary-700 text-white font-bold cursor-pointer shadow-[0_8px_20px_-8px_rgba(20,83,45,.6)] hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-700';
const ERR = 'flex items-center gap-1.5 mt-1.5 mb-.5 text-bug font-medium empty:hidden';

class AppRegister extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = '1';
    this.classList.add("w-screen", "flex", "justify-center", "items-center", "h-screen");
    this.renderRegister();
  }

  renderRegister() {
    this.innerHTML = `
        <form id="login-form" class="min-w-md">
            <h1 class="mb-2">Tạo tài khoản</h1>
            <form-field label="Họ tên" name="name" autocomplete="name" placeholder="Nguyễn Văn A"></form-field>
            <form-field label="Email" name="email" type="email" autocomplete="email" placeholder="example@email.com"></form-field>
            <form-field label="Số điện thoại" name="phoneNumber" type="tel" autocomplete="tel" placeholder="0901234567"></form-field>
            <hidden-field label="Password">
              <hidden-input name="password" autocomplete="new-password" placeholder="Nhập mật khẩu"></hidden-input>
            </hidden-field>
            <p data-error class="${ERR}"></p>
            <button type="submit" class="${BTN}">Đăng ký</button>
            <p class="mt-6 text-text text-center">Đã có tài khoản <a href="${LOGIN_URL}" class="text-primary-600 font-medium no-underline hover:underline hover:underline-offset-3 rounded-sm">ĐĂNG NHẬP</a></p>
        </form>`;
    this.bind(data => this.register(data));
  }

  renderActivate(email) {
    this.innerHTML = `
        <form id="login-form" class="min-w-md">
            <h1 class="mb-2">Kích hoạt tài khoản</h1>
            <p class="mb-3">Nhập mã OTP đã gửi tới <b>${email.replace(/[<>&"]/g, '')}</b></p>
            <form-field label="Mã OTP" name="code" autocomplete="one-time-code" placeholder="123456"></form-field>
            <p data-error class="${ERR}"></p>
            <button type="submit" class="${BTN}">Kích hoạt</button>
            <button type="button" data-resend class="mt-3 w-full text-primary-600 font-medium cursor-pointer hover:underline">Gửi lại mã OTP</button>
        </form>`;
    this.bind(data => this.activate(email, data));
    this.querySelector('[data-resend]').addEventListener('click', async () => {
      this.setError('');
      try { await http('POST', '/auth/resend-otp', email, { auth: false, text: true }); this.setError('Đã gửi lại mã OTP, vui lòng kiểm tra email'); }
      catch (err) { this.setError(err.message); }
    });
  }

  bind(handler) {
    this.form = this.querySelector('form');
    this.error = this.querySelector('[data-error]');
    this.submitBtn = this.querySelector('[type="submit"]');
    this.form.addEventListener('submit', async e => {
      e.preventDefault();
      this.setError('');
      this.submitBtn.disabled = true;
      try { await handler(Object.fromEntries(new FormData(this.form))); }
      catch (err) { this.setError(err.message); }
      finally { this.submitBtn.disabled = false; }
    });
  }

  async register(data) {
    // POST /auth/register {name, email, phoneNumber, password}
    const body = { name: data.name?.trim(), email: data.email?.trim(), phoneNumber: data.phoneNumber?.trim(), password: data.password };
    await http('POST', '/auth/register', body, { auth: false });
    this.renderActivate(body.email);
  }

  async activate(email, data) {
    // POST /auth/activate-account {email, code}
    await http('POST', '/auth/activate-account', { email, code: data.code?.trim() }, { auth: false });
    location.href = LOGIN_URL;
  }

  setError(msg) {
    this.error.textContent = msg;
    this.error.classList.toggle('hidden', !msg);
  }
}

customElements.define('app-register', AppRegister);
