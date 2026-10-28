/** accessToken + refreshToken trong body */
const ACCESS = 'sr:accessToken';
const REFRESH = 'sr:refreshToken';
const USER = 'sr:user';

const get = k => {
    try {
        return localStorage.getItem(k);
    } catch {
        return null;
    }
}

const set = (k, v) => {
    try {
        v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    } catch {

    }
}

export const auth = {
    get accessToken() {
        return get(ACCESS);
    },
    get refreshToken() {
        return get(REFRESH);
    },
    get user() {
        try {
            return JSON.parse(get(USER) ?? 'null');
        } catch {
            return null;
        }
    },
    isLoggedIn() {
        return Boolean(get(ACCESS) || get(REFRESH));
    },
    save({ accessToken, refreshToken, userId, email, name }) {
        set(ACCESS, accessToken);
        set(REFRESH, refreshToken);
        set(USER, JSON.stringify({ userId, email, name }));
    },
    setAccess(token) {
        set(ACCESS, token);
    },
    clear() {
        set(ACCESS, null);
        set(REFRESH, null);
        set(USER, null);
    },
}