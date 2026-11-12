import { openDialog, bindActions } from '../../utils/dialog.js';
import { qrSvg } from '../../utils/qr.js';
import { esc } from '../../utils/format.js';
import { buildAttendanceQr } from '../../services/AttendanceService.js';

const TTL = 500000;     // giây hiệu lực của mỗi mã
const ROTATE = 500000;  // giây đổi mã một lần

/** Hiển thị QR chấm công tại quán: tự đổi mã liên tục để không dùng lại được mã chụp từ trước. */
export function attendanceQrDialog(shopId, shopName = '') {
    return openDialog({
        title: 'QR chấm công',
        width: 460,
        render(body, close, dlg) {
            let timer = 0, url = '', age = 0;
            dlg.addEventListener('close', () => clearInterval(timer));
            body.innerHTML = `
                <div class="text-center">
                    ${shopName ? `<p class="mb-2 text-sm font-bold">${esc(shopName)}</p>` : ''}
                    <div data-qr class="mx-auto aspect-square w-full max-w-88 rounded-2xl border border-primary-200 bg-white p-2 [&>svg]:size-full"></div>
                    <div class="mx-auto mt-3 h-1.5 max-w-88 overflow-hidden rounded-full bg-primary-50"><div data-bar class="h-full bg-primary-600 transition-[width] duration-1000 ease-linear"></div></div>
                    <p data-url class="mt-2 break-all rounded-lg bg-neutral-50 p-2 text-left text-[11px] text-secondary-700"></p>
                    <p class="mt-2 text-xs leading-relaxed text-secondary-700">Nhân viên mở camera hoặc chọn “Quét QR chấm công” trên điện thoại rồi quét mã này. Mã tự đổi mỗi ${ROTATE} giây; hãy để màn hình này ở quầy, đừng gửi ảnh chụp.</p>
                    <div class="mt-4 flex justify-center gap-3">
                        <p-button data-act="open" label="Mở thử" icon="eye"></p-button>
                        <p-button data-act="copy" label="Sao chép link"></p-button>
                        <p-button data-act="cancel" label="Đóng"></p-button>
                    </div>
                </div>`;
            const box = body.querySelector('[data-qr]');
            const bar = body.querySelector('[data-bar]');
            const refresh = () => {
                url = buildAttendanceQr(shopId, TTL).url;
                box.innerHTML = qrSvg(url, { level: 'M' });
                body.querySelector('[data-url]').textContent = url;
                age = 0;
                bar.style.transition = 'none';
                bar.style.width = '100%';
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    bar.style.transition = `width ${ROTATE}s linear`;
                    bar.style.width = '0%';
                }));
            };
            refresh();
            timer = setInterval(() => { if (++age >= ROTATE) refresh(); }, 1000);
            bindActions(body, {
                cancel: () => close(),
                open: () => window.open(url, '_blank', 'noopener'),
                copy: async el => {
                    try { await navigator.clipboard.writeText(url); el.setAttribute('label', 'Đã sao chép'); }
                    catch { el.setAttribute('label', 'Không sao chép được'); }
                },
            });
        },
    });
}
