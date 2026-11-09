import { NO_CONTENT } from '../config.js';

/**
 * Trang quản lý: khi máy chủ từ chối quyền xem dữ liệu (GET trả 403) thì ẩn toàn bộ phần nội dung
 * (giữ thanh điều hướng và tiêu đề) và chỉ hiện "Không có nội dung", không render các khối giao diện.
 */
let shown = false;
function showNoContent() {
    if (shown) return;
    const nav = document.querySelector('app-navigation');
    const wrap = nav?.nextElementSibling;
    if (!wrap) return;
    shown = true;
    [...wrap.children].filter(el => el.tagName !== 'APP-HEADER').forEach(el => { el.style.display = 'none'; });
    const box = document.createElement('div');
    box.setAttribute('role', 'status');
    box.className = 'grid justify-items-center gap-2 px-4 py-24 text-center text-secondary-700';
    box.innerHTML = `<svg class="size-11 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h8"/></svg><p class="text-base font-semibold">${NO_CONTENT}</p>`;
    wrap.append(box);
}
window.addEventListener('sr:no-access', showNoContent);
