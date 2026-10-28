import { auth } from '../services/AuthStore.js';

class AppHeader extends HTMLElement {
    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        
        const title = this.getAttribute('title') ?? '';
        const dataTitle = this.getAttribute('data-title') ?? '';
        const userName = auth.user?.name || this.getAttribute('username') || 'Admin';
        const userImage = this.getAttribute('user-image') ?? 'https://placehold.co/400';
        const userRole = this.getAttribute('user-role') ?? 'Chức vụ';

        this.classList.add('block');
        this.innerHTML = `
            <header class="flex w-full justify-between items-center p-5">
                <div>
                    <h4 class="text-text">${title}</h4>
                    <p class="font-extralight text-support-800">${dataTitle}</p>
                </div>
                <div class="flex gap-3">
                    <img class="size-11 rounded-3xl" src="${userImage}" alt="User Image" />
                    <div>
                        <p class="font-bold text-text">${userName}</p>
                        <p class="text-xs text-support-800">${userRole}</p>
                    </div>
                </div>
            </header>
        `;
    }
}

customElements.define('app-header', AppHeader);