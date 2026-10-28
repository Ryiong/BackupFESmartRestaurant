import { SPRING_BASE, LOGIN_URL } from '../config.js';
import { auth } from './AuthStore.js';

/**
 * Client gọi backend Spring Boot.
 *  - Gửi header `Authorization: Bearer <accessToken>` (BE dùng JWT header, KHÔNG dùng cookie).
 *  - BE guwir kết quả: { code, message, data, timeStamp } → hàm trả về thẳng `data`.
 *  - Lỗi: ném Error(message của BE).
 *  - 401 → thử refresh token 1 lần rồi gọi lại; nếu vẫn lỗi → về trang đăng nhập.
 *
 * http(method, path, body?, { query, auth = true, text = false })
 *   path  : bắt đầu bằng "/" (vd "/area/shop/1")
 *   query : object → ?a=1&b=2 (bỏ qua undefined/null)
 *   text  : gửi body là chuỗi thô (text/plain) – dùng cho @RequestBody String
 */
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

export function logoutRedirect() {
    auth.clear();
    location.href = LOGIN_URL;
}

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
    if (body !== undefined) {
        headers['Content-Type'] = text ? 'text/plain;charset=UFT-8' : 'application/json';
    }
    if (useAuth && auth.accessToken) {
        headers.Authorization = `Bearer ${auth.accessToken}`;
    }

    let res;
    try {
        res = await fetch(buildUrl(path, query), {
            method,
            headers,
            body: body === undefined ? undefined : text ? String(body) : JSON.stringify(body),
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
