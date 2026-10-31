import { ICONS, LOGO } from '../icon.js';
import { http, logoutRedirect, requireLogin } from '../services/HttpClient.js';
import { auth } from '../services/AuthStore.js';
import { BASE_URL } from '../config.js';

const NAV = [
    { href: `${BASE_URL}/admin/index.html`, name: 'Tổng quan', icon: 'dashboard' },
    { href: `${BASE_URL}/admin/area.html`, name: 'Bàn & Khu vực', icon: 'table' },
    { href: `${BASE_URL}/admin/menu.html`, name: 'Thực đơn', icon: 'menu' },
    { href: '#', name: 'Kho nguyên liệu', icon: 'storage' },
    { href: '#', name: 'Cài đặt', icon: 'setting' },

];

const LINK_BASE = 'w-full flex items-center justify-center rounded-lg hover:bg-primary-50 transition-all cursor-pointer';
const LINK_ACTIVE = 'bg-primary-100 text-accent-900';
const LINK_IDLE = 'text-support-900';

class AppNavigation extends HTMLElement {
    connectedCallback() {
        if (this.dataset.ready) return;
        if (!requireLogin()) return;
        this.dataset.ready = '1';

        this.classList.add('block', 'fixed', 'top-0', 'left-0', 'h-screen', 'w-min', 'z-50', 'bg-white');
        const current = location.pathname;

        const items = NAV.map(n => {
            const active = current === n.href;
            if (active) document.title = n.name;
            return `
        <li class="${LINK_BASE} ${active ? LINK_ACTIVE : LINK_IDLE}">
          <a href="${n.href}" title="${n.name}" aria-label="${n.name}"
             ${active ? 'aria-current="page"' : ''} class="p-2.5">
            ${ICONS[n.icon]}
          </a>
        </li>`;
        }).join('');

        this.innerHTML = `
            <nav id="app-navigation" class="h-full shadow-[0_4px_8px_var(--color-secondary-100)]">
                <div id="navigation__header" class="w-15 h-15 p-2 pt-4 m-auto text-primary">
                    <div class="mx-auto">${LOGO}</div>
                </div>
                <div id="navigation__content" class="h-full flex flex-col justify-around">
                    <div id="navigation__scrollable-container">
                        <ul id="navigation_list" class="flex flex-col items-center gap-2 overflow-y-auto px-2">
                            ${items}
                        </ul>
                    </div>
                    <div id="navigation__footer" class="flex items-center justify-center m-3">
                    <button id="navigation__footer-button" class="w-13 h-15 text-primary-600 bg-primary-200 rounded-lg flex items-center justify-center hover:bg-primary-400 hover:text-white hover:scale-90 transition-all cursor-pointer">
                        ${ICONS.logout}
                    </button>
                </div>
                </div>
                
            </nav>
        `;

        this.logoutBtn = this.querySelector('#navigation__footer-button');

        this.logoutBtn.addEventListener('click', e => this.onClick(e));
    }

    async onClick(e) {
        e.preventDefault();
        this.logoutBtn.disabled = true;
        try {
            // POST /auth/logout?refreshToken=...
            if (auth.refreshToken) await http('POST', '/auth/logout', undefined, { query: { refreshToken: auth.refreshToken }, auth: false });
        } catch { /* vẫn đăng xuất phía client */ }
        logoutRedirect();
    }
}

customElements.define('app-navigation', AppNavigation);