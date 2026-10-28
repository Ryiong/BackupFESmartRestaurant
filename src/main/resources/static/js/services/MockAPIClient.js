import { MOCKAPI_BASE } from '../config.js';

export async function mockApi(method, path, { body, query } = {}) {
    if (!MOCKAPI_BASE || MOCKAPI_BASE.includes('YOUR_PROJECT_ID')) {
        throw new Error('Chưa cấu hình MOCKAPI_BASE trong static/js/config.js');
    }
    const qs = query ? `?${new URLSearchParams(query)}` : '';
    let res;
    try {
        res = await fetch(`${MOCKAPI_BASE}${path}${qs}`, {
            method,
            headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
    } catch {
        throw new Error('Không kết nối được MockAPI, kiểm tra mạng hoặc MOCKAPI_BASE');
    }
    if (!res.ok) {
        const err = new Error(`MockAPI lỗi ${res.status} (${method} ${path})`);
        err.status = res.status;
        throw err;
    }
    return res.status === 204 ? null : res.json();
}

export async function mockApiList(path, query) {
    try {
        const rows = await mockApi('GET', path, { query });
        return Array.isArray(rows) ? rows : [];
    } catch (err) {
        if (err.status === 404) return [];
        throw err;
    }
}
