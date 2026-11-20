// Tuỳ chọn giao diện của từng thiết bị (lưu localStorage): hoạt ảnh, theme màu, cỡ chữ.
// Được nạp từ config.js nên áp dụng ngay ở mọi trang (đăng nhập, quản lý, nhân viên…).
const KEY = 'sr:prefs';

export const THEMES = [
    { key: 'honey', label: 'Mật ong', color: '#FFCA00' },
    { key: 'amber', label: 'Hổ phách', color: '#FF9F1C' },
    { key: 'leaf', label: 'Xanh lá', color: '#8BC34A' },
    { key: 'ocean', label: 'Xanh dương', color: '#4DA3FF' },
];
export const MOTIONS = [
    { key: 'auto', label: 'Theo hệ thống', desc: 'Tự giảm hoạt ảnh nếu thiết bị bật "giảm chuyển động".' },
    { key: 'on', label: 'Luôn bật', desc: 'Hoạt ảnh mượt đầy đủ.' },
    { key: 'off', label: 'Tắt', desc: 'Không hoạt ảnh – nhẹ máy, ít xao nhãng.' },
];
export const TEXT_SIZES = [
    { key: 'md', label: 'Vừa', size: '' },
    { key: 'lg', label: 'Lớn', size: '112.5%' },
    { key: 'xl', label: 'Rất lớn', size: '125%' },
];
const DEFAULTS = { motion: 'auto', theme: 'honey', text: 'md' };

const read = () => {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...DEFAULTS }; }
};

export function applyPrefs(p = read()) {
    const root = document.documentElement;
    root.dataset.motion = MOTIONS.some(m => m.key === p.motion) ? p.motion : 'auto';
    root.dataset.theme = THEMES.some(t => t.key === p.theme) ? p.theme : 'honey';
    root.style.fontSize = TEXT_SIZES.find(t => t.key === p.text)?.size ?? '';
}

export const prefs = {
    get: read,
    set(patch) {
        const next = { ...read(), ...patch };
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* chế độ riêng tư: chỉ áp dụng trong phiên */ }
        applyPrefs(next);
        window.dispatchEvent(new CustomEvent('sr:prefs', { detail: next }));
        return next;
    },
    reset() { try { localStorage.removeItem(KEY); } catch { } applyPrefs(DEFAULTS); window.dispatchEvent(new CustomEvent('sr:prefs', { detail: { ...DEFAULTS } })); },
};

applyPrefs();
