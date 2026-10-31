import { auth } from '../services/AuthStore.js';
import { API_MODE, ADMIN_URL } from '../config.js';
import { getCurrentShop, onShopChange, STATUS_LABEL } from '../services/ShopService.js';
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
            <header class="flex w-full justify-between items-center p-5">
                <div>
                    <h4 class="text-text">${title}</h4>
                    <p class="font-extralight text-support-800">${dataTitle}</p>
                </div>
                <div class="flex items-center gap-2">
                    <div class="flex gap-3">
                        <img class="size-11 rounded-3xl" src="${userImage}" alt="User Image" />
                        <div>
                            <p class="font-bold text-text">${userName}</p>
                            <p class="text-xs text-support-800">${userRole}</p>
                        </div>
                    </div>
                    <a data-shop hidden href="${ADMIN_URL}" title="Đổi hoặc chỉnh sửa cửa hàng ở trang Tổng quan"
                        class="flex mt-2 max-w-full items-center gap-2 rounded-lg border border-primary-200 bg-white px-3 py-1 text-xs text-primary-700">
                        <span class="text-support-800">Cửa hàng:</span>
                        <span data-shop-name class="line-clamp-1 font-bold"></span>
                        <span data-shop-status class="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-bold"></span>
                    </a>
                </div>
            </header>
        `;

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
            badge.className = `shrink-0 rounđe-full px-2 py-0.5 text-[10px] font-bold ${status.cls}`;
            badge.textContent = status.text;
        }
    }
}

customElements.define('app-header', AppHeader);