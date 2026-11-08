import { http } from './HttpClient.js';
import { auth } from './AuthStore.js';
import { ADMIN_URL, BASE_URL, LOGIN_URL, STAFF_BASE_URL } from '../config.js';

export const publicUrl = path => `${STAFF_BASE_URL || location.origin}${path}`;

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

export async function landingUrl() {
    // const next = safeNext();
    // if (next) return next;
    try {
        const me = await http('GET', '/auth/me');
        auth.setType(me?.type);
    } catch {
    }
    return ADMIN_URL;
}

/* ---------- QR đăng nhập sang thiết bị khác ---------- */

export const loginQrUrl = refreshToken => `${publicUrl(LOGIN_URL)}#qr=${encodeURIComponent(refreshToken)}`;

export function parseLoginQr(text) {
    let u;
    try { u = new URL(String(text).trim()); } catch { throw new Error('Đây không phải mã QR đăng nhập.'); }
    if (!u.pathname.endsWith('/auth/login.html')) throw new Error('Đây không phải mã QR đăng nhập.');
    const token = new URLSearchParams(u.hash.replace(/^#/, '')).get('qr');
    if (!token) throw new Error('Đây không phải mã QR đăng nhập.');
    return token;
}

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