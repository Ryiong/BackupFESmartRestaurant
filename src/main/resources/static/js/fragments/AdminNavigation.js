import { ICONS, LOGO } from '../icon.js';
import { requireLogin, logout } from '../services/HttpClient.js';
import { auth } from '../services/AuthStore.js';
import { BASE_URL, STAFF_ATTENDANCE_URL } from '../config.js';
import { listShops, onShopChange } from '../services/ShopService.js';

const NAV = [
    { href: `${BASE_URL}/admin/index.html`, name: 'Tổng quan', icon: 'dashboard' },
    { href: `${BASE_URL}/admin/area.html`, name: 'Bàn & Khu vực', icon: 'table' },
    { href: `${BASE_URL}/admin/menu.html`, name: 'Thực đơn', icon: 'menu' },
    { href: `${BASE_URL}/admin/storage.html`, name: 'Kho nguyên liệu', icon: 'storage' },
    { href: `${BASE_URL}/admin/settings.html`, name: 'Cài đặt', icon: 'setting' },

];

const LINK_BASE = 'flex-1 md:flex-none md:w-full flex items-center justify-center rounded-lg hover:bg-primary-50 transition-all cursor-pointer';
const LINK_ACTIVE = 'bg-primary-100 text-accent-900';
const LINK_IDLE = 'text-support-900';

class AppNavigation extends HTMLElement {
    connectedCallback() {
        if (this.dataset.ready) return;
        if (!requireLogin()) return;
        // Nhân viên không dùng trang quản lý: chuyển sang trang chấm công trên điện thoại.
        if (auth.user?.type === 'STAFF') { location.replace(STAFF_ATTENDANCE_URL); return; }
        this.dataset.ready = '1';

        this.classList.add('fixed', 'inset-x-0', 'bottom-0', 'z-50', 'bg-white', 'pb-[env(safe-area-inset-bottom)]',
            'md:inset-x-auto', 'md:top-0', 'md:left-0', 'md:block', 'md:h-screen', 'md:w-min', 'md:pb-0');
        const current = location.pathname;

        const items = NAV.map(n => {
            const active = current === n.href;
            if (active) document.title = n.name;
            return `
        <li data-nav="${n.href}" data-name="${n.name}" class="${LINK_BASE} ${active ? LINK_ACTIVE : LINK_IDLE}">
          <a href="${n.href}" title="${n.name}" aria-label="${n.name}"
             ${active ? 'aria-current="page"' : ''} class="p-2.5 md:p-2.5 flex size-full items-center justify-center min-h-12">
            ${ICONS[n.icon]}
          </a>
        </li>`;
        }).join('');

        this.innerHTML = `
            <nav id="app-navigation" class="md:h-full shadow-[0_-2px_8px_var(--color-secondary-100)] md:shadow-[0_4px_8px_var(--color-secondary-100)]">
                <div id="navigation__header" class="hidden md:block w-15 h-15 p-2 pt-4 m-auto text-primary">
                    <div class="mx-auto">${LOGO}</div>
                </div>
                <div id="navigation__content" class="flex items-stretch md:h-full md:flex-col md:justify-around">
                    <div id="navigation__scrollable-container" class="flex-1 md:flex-none">
                        <ul id="navigation_list" class="flex items-center gap-1 px-1 md:flex-col md:gap-2 md:overflow-y-auto md:px-2">
                            ${items}
                        </ul>
                    </div>
                    <div id="navigation__footer" class="hidden items-center justify-center md:m-3 md:flex">
                    <button id="navigation__footer-button" class="w-12 h-12 md:w-13 md:h-15 text-primary-600 bg-primary-200 rounded-lg flex items-center justify-center hover:bg-primary-400 hover:text-white hover:scale-90 transition-all cursor-pointer">
                        ${ICONS.logout}
                    </button>
                </div>
                </div>
                
            </nav>
        `;

        this.logoutBtn = this.querySelector('#navigation__footer-button');

        this.logoutBtn.addEventListener('click', e => this.onClick(e));

        this.applyShopGate();
        onShopChange(() => this.applyShopGate());
    }

    async applyShopGate() {
        let shops;
        try {
            shops = await listShops();
        }
        catch { 
            return;
        }
        const locked = Array.isArray(shops) && shops.length === 0;
        const index = NAV[0].href;
        this.querySelectorAll('li[data-nav]').forEach(li => {
            const a = li.querySelector('a');
            const lock = locked && li.dataset.nav !== index;
            li.classList.toggle('opacity-40', lock);
            li.classList.toggle('cursor-not-allowed', lock);
            if (lock) {
                a.removeAttribute('href');
                a.setAttribute('aria-disabled', 'true');
                a.tabIndex = -1;
                a.title = `${li.dataset.name} (Hiện tại không khả dụng vì bạn chưa có cửa hàng nào. Vui lòng tạo cửa hàng trước khi truy cập trang này.)`;
                a.classList.add('pointer-events-none');
            } else {
                a.setAttribute('href', li.dataset.nav);
                a.removeAttribute('aria-disabled');
                a.removeAttribute('tabindex');
                a.title = li.dataset.name;
                a.classList.remove('pointer-events-none');
            }
        });
        if (locked && location.pathname !== index) {
            location.replace(index);
        }
    }

    async onClick(e) {
        e.preventDefault();
        this.logoutBtn.disabled = true;
        await logout();
    }
}

customElements.define('app-navigation', AppNavigation);
