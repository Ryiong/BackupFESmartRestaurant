import { SPRING_BASE, LOGIN_URL } from '../config.js';
import { auth } from './AuthStore.js';

const buildUrl = (path, query) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) {
        if (v !== undefined && v !== null && v !== '') {
            qs.append(k, v);
        }
    }
    const s = qs.toString();
    return `${SPRING_BASE}${path.startsWith('/') ? path : `/${path}`}${s ? `?${s}` : ''}`;
}

let refreshing = null;

function refreshAccessToken() {
    const rt = auth.refreshToken;
    if (!rt) {
        return Promise.resolve(false);
    }
    refreshing ??= (async () => {
        try {
            const token = await http('POST', '/auth/refresh-token',
                undefined,
                {
                    query: {
                        refreshToken: rt
                    },
                    auth: false,
                    retry: false
                }
            );
            if (!token) {
                return false;
            }
            auth.setAccess(token);
            return true;
        } catch {
            return false;
        }
        finally {
            refreshing = null;
        }
    })();
    return refreshing;
}

let loggingOut = false;

export function logoutRedirect() {
    if (loggingOut) return;
    loggingOut = true;
    auth.clear();
    location.href = LOGIN_URL;
}

/**
 * Token còn hạn nhưng tài khoản không còn dùng được: backend (JwtFilter) trả 404 "Người dùng không tồn tại"
 * khi user trong token đã bị xoá / DB bị reset, hoặc 409 "Trạng thái tài khoản không được chấp thuận" khi tài khoản bị khoá.
 * Hai trường hợp này không phải 401 nên phải nhận ra riêng, nếu không giao diện cứ ở lại trang cho đến khi token hết hạn.
 */
const isDeadSession = (status, message = '') =>
    (status === 404 && /^Người dùng không tồn tại/i.test(message))
    || (status === 409 && /^Trạng thái tài khoản không được chấp thuận/i.test(message));

export async function http(method,
    path,
    body,
    {
        query,
        auth: useAuth = true,
        text = false,
        retry = true
    } = {}
) {
    const headers = { Accept: 'application/json' };
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body !== undefined && !isForm) {
        headers['Content-Type'] = text ? 'text/plain;charset=UTF-8' : 'application/json';
    }
    if (useAuth && auth.accessToken) {
        headers.Authorization = `Bearer ${auth.accessToken}`;
    }

    let res;
    try {
        res = await fetch(buildUrl(path, query), {
            method,
            headers,
            body: body === undefined ? undefined : isForm ? body : text ? String(body) : JSON.stringify(body),
        });
    } catch (e) {
        throw new Error(`Bug ${e} - Không kết nối được máy chủ, vui lòng thử lại`);
    }

    if (res.status === 401 && useAuth) {
        if (retry && await refreshAccessToken()) {
            return http(method, path, body, { query, auth: useAuth, text, retry: false });
        }
        logoutRedirect();
        throw new Error("Phiên đăng nhập đã hết hạn");
    }

    let payload = null;
    try {
        payload = await res.json();
    } catch { }

    if (!res.ok && useAuth && isDeadSession(res.status, payload?.message)) {
        logoutRedirect();
        throw new Error('Tài khoản không còn hiệu lực, vui lòng đăng nhập lại');
    }

    if (!res.ok) {
        throw new Error(payload?.message || (res.status === 403 ? 'Bạn không có quyền thực hiện thao tác này' : 'Có lỗi xảy ra, vui lòng thử lại'));
    }

    return payload && 'data' in payload ? payload.data : payload;
}

export async function httpAll(path, query = {}, size = 100) {
    const out = [];
    for (let page = 0; ; page++) {
        const p = await http('GET', path, undefined, { query: { ...query, page, size } });
        out.push(...(p?.content ?? []));
        if (!p || p.last !== false || page >= (p.totalPages ?? 1) - 1) {
            break;
        }
    }
    return out;
}

export function requireLogin() {
    if (!auth.isLoggedIn()) {
        location.replace(LOGIN_URL);
        return false;
    }
    return true;
}