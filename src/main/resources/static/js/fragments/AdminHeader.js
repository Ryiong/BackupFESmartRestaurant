import { auth } from '../services/AuthStore.js';
import { API_MODE } from '../config.js';
import { getCurrentShop, onShopChange, STATUS_LABEL } from '../services/ShopService.js';
import { ICONS } from '../icon.js';
import { esc, titleCase } from '../utils/format.js';

class AppHeader extends HTMLElement {
    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        
        const title = this.getAttribute('title') ?? '';
        const dataTitle = this.getAttribute('data-title') ?? '';
        const userName = auth.user?.name || this.getAttribute('username') || 'Admin';
        const userImage = this.getAttribute('user-image') ?? 'https://placehold.co/400';
        const userRole = this.getAttribute('user-role') ?? 'Chức vụ';

        this.baseTitle = document.title;
        this.showShop = API_MODE === 'spring' && !this.hasAttribute('no-shop');
        this.classList.add('block');
        this.innerHTML = `
            <header class="flex w-full flex-wrap justify-between items-center gap-2 p-4 md:p-5">
                <div>
                    <h4 class="text-text">${title}</h4>
                    <p class="font-extralight text-text">${dataTitle}</p>
                </div>
                <div class="flex w-full flex-wrap items-center gap-2 md:w-auto">
                    <div class="flex min-w-0 flex-1 items-center gap-3 md:flex-none">
                        <img class="size-11 shrink-0 rounded-3xl" src="${userImage}" alt="User Image" />
                        <div data-shop>
                            <p class="font-bold text-text">${userName}</p>
                            <p class="text-xs text-support-800">${userRole}
                                <span data-shop-name class="min-w-0 flex-1 truncate font-bold md:flex-none"></span>
                                <span data-shop-status class="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold"></span>
                            </p>
                        </div>
                    </div>
                    <button type="button" data-loginqr title="Tạo QR đăng nhập trên thiết bị khác" aria-label="Tạo QR đăng nhập trên thiết bị khác"
                        class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-white text-support-100 hover:scale-105 transition-all">${ICONS.qr}</button>
                    
                </div>
            </header>
        `;

        this.querySelector('[data-loginqr]').addEventListener('click', async () =>
            (await import('./auth/LoginQrDialog.js')).loginQrDialog());
        this.chip = this.querySelector('[data-shop]');
        if (API_MODE === 'spring') {
            this.off = onShopChange(() => this.paintShop());
            this.paintShop();
        }
    }

    disconnectedCallback() {
        this.off?.();
    }

    async paintShop() {
        let shop = null;
        try {
            shop = await getCurrentShop();
        }
        catch { }

        const name = shop ? titleCase(shop.name) : '';
        document.title = name ? `${this.baseTitle} - ${name}` : this.baseTitle;

        if (!this.showShop) return;
        this.chip.hidden = !shop;
        if (!shop) return;

        this.chip.querySelector('[data-shop-name]').textContent = name;
        const badge = this.chip.querySelector('[data-shop-status');
        const status = STATUS_LABEL[shop.status];
        badge.hidden = !status;
        if (status) {
            badge.className = `shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`;
            badge.textContent = status.text;
        }
    }
}

customElements.define('app-header', AppHeader);