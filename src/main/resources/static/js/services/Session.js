import { http } from './HttpClient.js';
import { auth } from './AuthStore.js';
import { ADMIN_URL, BASE_URL, LOGIN_URL, STAFF_ATTENDANCE_URL, STAFF_BASE_URL, SYSTEM_URL } from '../config.js';

/** Link tuyệt đối để nhét vào mã QR (điện thoại quét cần link đầy đủ, không phải đường dẫn tương đối). */
export const publicUrl = path => `${STAFF_BASE_URL || location.origin}${path}`;

/**
 * Trang cần quay lại sau khi đăng nhập (tham số ?next=). Chỉ nhận đường dẫn nội bộ của ứng dụng,
 * tránh bị lợi dụng để chuyển người dùng sang trang lạ.
 */
export function safeNext(search = location.search) {
    const next = new URLSearchParams(search).get('next');
    if (!next) return null;
    try {
        const u = new URL(next, location.origin);
        if (u.origin !== location.origin || !u.pathname.startsWith(`${BASE_URL}/`)) return null;
        if (u.pathname === LOGIN_URL) return null;
        return u.pathname + u.search;
    } catch {
        return null;
    }
}

/** Đăng nhập xong thì về đâu: trang đang dở (next) > chấm công (nhân viên) > duyệt cửa hàng (quản trị hệ thống) > quản lý cửa hàng. */
export async function landingUrl() {
    const next = safeNext();
    if (next) return next;
    try {
        const me = await http('GET', '/auth/me');
        auth.setType(me?.type);
        return me?.type === 'STAFF' ? STAFF_ATTENDANCE_URL : me?.type === 'ADMIN' ? SYSTEM_URL : ADMIN_URL;
    } catch {
        return ADMIN_URL;
    }
}

/* ---------- QR đăng nhập sang thiết bị khác ---------- */

/** Link trong QR: refresh token đặt ở phần #fragment nên không bao giờ được gửi lên máy chủ hay ghi vào log truy cập. */
export const loginQrUrl = refreshToken => `${publicUrl(LOGIN_URL)}#qr=${encodeURIComponent(refreshToken)}`;

/** Lấy refresh token từ nội dung QR đăng nhập. Ném Error nếu đó không phải QR đăng nhập. */
export function parseLoginQr(text) {
    let u;
    try { u = new URL(String(text).trim()); } catch { throw new Error('Đây không phải mã QR đăng nhập.'); }
    if (!u.pathname.endsWith('/auth/login.html')) throw new Error('Đây không phải mã QR đăng nhập.');
    const token = new URLSearchParams(u.hash.replace(/^#/, '')).get('qr');
    if (!token) throw new Error('Đây không phải mã QR đăng nhập.');
    return token;
}

/** Đổi refresh token (từ QR) lấy một phiên đăng nhập mới trên thiết bị này. */
export async function signInWithRefreshToken(refreshToken) {
    let accessToken;
    try {
        accessToken = await http('POST', '/auth/refresh-token', undefined, { query: { refreshToken }, auth: false, retry: false });
    } catch {
        throw new Error('Mã QR đăng nhập không hợp lệ hoặc đã hết hạn, hãy tạo mã mới.');
    }
    if (!accessToken) throw new Error('Mã QR đăng nhập không hợp lệ hoặc đã hết hạn, hãy tạo mã mới.');
    auth.save({ accessToken, refreshToken });
    try {
        const me = await http('GET', '/auth/me', undefined, { retry: false });
        auth.save({ accessToken, refreshToken, email: me?.email, name: me?.name, type: me?.type });
    } catch (err) {
        auth.clear();
        throw err;
    }
}
