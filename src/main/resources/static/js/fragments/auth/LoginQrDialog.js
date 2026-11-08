import { openDialog, bindActions } from '../../utils/dialog.js';
import { qrSvg } from '../../utils/qr.js';
import { esc, INPUT_CLS } from '../../utils/format.js';
import { http } from '../../services/HttpClient.js';
import { auth } from '../../services/AuthStore.js';
import { loginQrUrl } from '../../services/Session.js';

const TTL = 60; // giây hiển thị mã trước khi xoá khỏi màn hình

/**
 * Tạo QR để đăng nhập tài khoản này trên thiết bị khác.
 * Cần nhập lại mật khẩu: việc đó tạo ra một phiên đăng nhập RIÊNG cho thiết bị kia, độc lập với phiên hiện tại
 * (đăng xuất ở máy nào chỉ ảnh hưởng máy đó). Mã trong QR có tác dụng như mật khẩu nên chỉ hiện trong 60 giây.
 */
export function loginQrDialog() {
    return openDialog({
        title: 'Đăng nhập trên thiết bị khác',
        width: 420,
        render(body, close, dlg) {
            const email = auth.user?.email ?? '';
            let timer = 0;
            const stop = () => clearInterval(timer);
            dlg.addEventListener('close', stop);

            const askPassword = (error = '') => {
                stop();
                body.innerHTML = `
                    <form class="grid gap-4" novalidate>
                        <p class="text-sm leading-relaxed">Nhập lại mật khẩu của <b>${esc(email)}</b> để tạo mã QR. Sau đó mở trang đăng nhập ở thiết bị kia, chọn “Quét QR đăng nhập” (hoặc dùng camera) rồi quét mã.</p>
                        <input name="password" type="password" autocomplete="current-password" placeholder="Mật khẩu" required class="${INPUT_CLS}">
                        <p data-err role="alert" class="${error ? '' : 'hidden'} text-sm font-semibold text-red-600">${esc(error)}</p>
                        <div class="flex justify-center gap-3">
                            <p-button type="submit" label="Tạo mã QR" icon="key" variant="solid"></p-button>
                            <p-button data-act="cancel" label="Huỷ"></p-button>
                        </div>
                    </form>`;
                const form = body.querySelector('form');
                const submit = form.querySelector('p-button[type="submit"]');
                form.addEventListener('submit', async e => {
                    e.preventDefault();
                    const password = form.elements.password.value;
                    if (!password) {
                        const err = body.querySelector('[data-err]');
                        err.textContent = 'Nhập mật khẩu';
                        err.classList.remove('hidden');
                        return;
                    }
                    submit.setAttribute('disabled', '');
                    try {
                        const res = await http('POST', '/auth/login', { email, password }, { auth: false });
                        showQr(res.refreshToken);
                    } catch (err) {
                        askPassword(err.message);
                    }
                });
                bindActions(body, { cancel: () => close() });
                form.elements.password.focus();
            };

            const showQr = token => {
                let left = TTL;
                body.innerHTML = `
                    <div class="text-center">
                        <div class="mx-auto aspect-square w-full max-w-80 rounded-2xl border border-primary-200 bg-white p-2 [&>svg]:size-full">${qrSvg(loginQrUrl(token), { level: 'L' })}</div>
                        <div class="mx-auto mt-3 h-1.5 max-w-80 overflow-hidden rounded-full bg-primary-50">
                            <div data-bar class="h-full bg-primary-600 transition-[width] duration-1000 ease-linear" style="width:100%"></div>
                        </div>
                        <p data-left class="mt-1 text-xs font-semibold text-secondary-700">Còn ${left} giây</p>
                        <p class="mt-3 rounded-lg bg-amber-50 p-3 text-left text-xs leading-relaxed text-amber-900">Mã này có tác dụng như mật khẩu của bạn: chỉ quét bằng thiết bị của chính bạn, không chụp màn hình hay gửi cho người khác.</p>
                        <div class="mt-4 flex justify-center"><p-button data-act="cancel" label="Đóng"></p-button></div>
                    </div>`;
                bindActions(body, { cancel: () => close() });
                const bar = body.querySelector('[data-bar]');
                const label = body.querySelector('[data-left]');
                requestAnimationFrame(() => { bar.style.width = '0%'; bar.style.transitionDuration = `${TTL}s`; });
                timer = setInterval(() => {
                    left -= 1;
                    label.textContent = `Còn ${left} giây`;
                    if (left <= 0) expired();
                }, 1000);
            };

            const expired = () => {
                stop();
                body.innerHTML = `
                    <div class="grid gap-4 text-center">
                        <p class="text-sm font-semibold">Mã QR đã hết hạn và được xoá khỏi màn hình.</p>
                        <div class="flex justify-center gap-3">
                            <p-button data-act="again" label="Tạo mã mới" variant="solid"></p-button>
                            <p-button data-act="cancel" label="Đóng"></p-button>
                        </div>
                    </div>`;
                bindActions(body, { again: () => askPassword(), cancel: () => close() });
            };

            askPassword();
        },
    });
}
