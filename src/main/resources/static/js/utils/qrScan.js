// Quét QR bằng camera. Ưu tiên BarcodeDetector có sẵn của trình duyệt (nhanh, nhẹ pin),
// không có thì dùng jsQR (chỉ tải khi thật sự cần).

export const canUseCamera = () => Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;

let jsQRPromise = null;
const loadJsQR = () => (jsQRPromise ??= import('./jsQR.js').then(m => m.default));

async function makeDecoder({ invert = false } = {}) {
    if ('BarcodeDetector' in window) {
        try {
            const formats = await window.BarcodeDetector.getSupportedFormats?.();
            if (!formats || formats.includes('qr_code')) {
                const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                return async src => (await detector.detect(src))[0]?.rawValue ?? null;
            }
        } catch { /* rơi xuống jsQR */ }
    }
    const jsQR = await loadJsQR();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return src => {
        const w0 = src.videoWidth || src.naturalWidth || src.width;
        const h0 = src.videoHeight || src.naturalHeight || src.height;
        if (!w0 || !h0) return null;
        // Thu nhỏ khung hình lớn: giữ đủ nét để đọc mà không làm điện thoại nóng máy.
        const k = Math.min(1, 800 / Math.max(w0, h0));
        canvas.width = Math.round(w0 * k);
        canvas.height = Math.round(h0 * k);
        ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return jsQR(img.data, img.width, img.height, { inversionAttempts: invert ? 'attemptBoth' : 'dontInvert' })?.data ?? null;
    };
}

const cameraError = e => {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return 'Bạn chưa cho phép dùng camera. Hãy cấp quyền camera cho trang này rồi thử lại.';
    if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'Không tìm thấy camera trên thiết bị này.';
    return 'Không mở được camera, hãy đóng các ứng dụng đang dùng camera rồi thử lại.';
};

/**
 * Mở camera vào `video` và quét liên tục. `onText(text)` được gọi với mỗi mã đọc được;
 * trả về true để dừng quét, trả về false/undefined để tiếp tục (vd mã không đúng loại).
 * Trả về hàm stop(). Ném Error có thông báo tiếng Việt nếu không mở được camera.
 */
export async function startScan(video, onText) {
    if (!canUseCamera()) {
        throw new Error('Camera chỉ dùng được khi trang chạy bằng HTTPS (hoặc localhost). Bạn vẫn có thể chọn ảnh có chứa mã QR.');
    }
    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e) {
        throw new Error(cameraError(e));
    }
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute('playsinline', '');
    try { await video.play(); } catch { /* một số trình duyệt tự phát khi có metadata */ }

    let alive = true, timer = 0, last = '', lastAt = 0;
    const stop = () => {
        alive = false;
        clearTimeout(timer);
        stream.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    };

    const decode = await makeDecoder();
    const loop = async () => {
        if (!alive) return;
        if (video.readyState >= 2 && video.videoWidth) {
            try {
                const text = await decode(video);
                // Cùng một mã lặp lại liên tục thì chỉ xử lý 1 lần mỗi 2 giây để khỏi báo lỗi dồn dập.
                if (text && alive && (text !== last || Date.now() - lastAt > 2000)) {
                    last = text; lastAt = Date.now();
                    if (await onText(text)) { stop(); return; }
                }
            } catch { /* khung hình lỗi, bỏ qua */ }
        }
        if (alive) timer = setTimeout(loop, 120);
    };
    loop();
    return stop;
}

/** Đọc mã QR từ một ảnh (chụp màn hình, ảnh trong thư viện). Trả về chuỗi hoặc null. */
export async function decodeImageFile(file) {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('Không đọc được ảnh này.'));
            i.src = url;
        });
        const decode = await makeDecoder({ invert: true });
        return await decode(img);
    } finally {
        URL.revokeObjectURL(url);
    }
}
