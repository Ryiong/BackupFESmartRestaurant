import { openDialog, bindActions } from './dialog.js';
import { startScan, decodeImageFile, canUseCamera } from './qrScan.js';
import { esc } from './format.js';

export function scanQrDialog({ title = 'Quét mã QR', hint = 'Đưa mã QR vào giữa khung hình.', accept = t => t }) {
    return openDialog({
        title,
        width: 440,
        render(body, close, dlg) {
            body.innerHTML = `
                <div class="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl bg-black">
                    <video data-video class="size-full object-cover" playsinline muted></video>
                    <div class="pointer-events-none absolute inset-[14%] rounded-2xl border-4 border-white/80"></div>
                </div>
                <p data-msg role="status" aria-live="polite" class="mt-3 min-h-10 text-center text-sm font-medium text-secondary-800">${esc(hint)}</p>
                <div class="mt-2 flex flex-wrap items-center justify-center gap-3">
                    <label class="inline-flex min-h-11 cursor-pointer items-center rounded-lg border-2 border-primary-100 bg-white px-3.5 text-sm font-bold text-primary-500 hover:border-primary-600">
                        Chọn ảnh có mã QR
                        <input data-file type="file" accept="image/*" class="sr-only">
                    </label>
                    <p-button data-act="cancel" label="Đóng"></p-button>
                </div>`;

            const msg = (text, bad = false) => {
                const el = body.querySelector('[data-msg]');
                el.textContent = text;
                el.classList.toggle('text-red-600', bad);
                el.classList.toggle('text-secondary-800', !bad);
            };

            const handle = text => {
                let value;
                try { value = accept(text); } catch (err) { msg(err.message || 'Mã QR không hợp lệ', true); return false; }
                if (value === null || value === undefined) { msg('Mã QR này không dùng được ở đây.', true); return false; }
                close(value);
                return true;
            };

            let stopScan = null, closed = false;
            dlg.addEventListener('close', () => { closed = true; stopScan?.(); });

            if (canUseCamera()) {
                msg('Đang mở camera…');
                startScan(body.querySelector('[data-video]'), handle)
                    .then(stop => { if (closed) stop(); else { stopScan = stop; msg(hint); } })
                    .catch(err => msg(err.message, true));
            } else {
                msg('Camera chỉ dùng được khi trang chạy bằng HTTPS (hoặc localhost). Hãy chọn ảnh có chứa mã QR.', true);
            }

            body.querySelector('[data-file]').addEventListener('change', async e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                    const text = await decodeImageFile(file);
                    if (!text) msg('Không tìm thấy mã QR trong ảnh này.', true);
                    else handle(text);
                } catch (err) {
                    msg(err.message || 'Không đọc được ảnh này.', true);
                }
            });

            bindActions(body, { cancel: () => close() });
        },
    });
}