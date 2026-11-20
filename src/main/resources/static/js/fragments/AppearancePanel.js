// <app-appearance>: tuỳ chọn giao diện cho thiết bị này – hoạt ảnh, theme màu, cỡ chữ.
import '../components/PrimaryButton.js';
import { prefs, THEMES, MOTIONS, TEXT_SIZES } from '../utils/prefs.js';
import { toast } from '../utils/dialog.js';
import { ICONS } from '../icon.js';

const CARD = 'rounded-2xl border border-primary-100 bg-white p-4 shadow-sm sm:p-5';

class AppearancePanel extends HTMLElement {
    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.classList.add('block');
        this.draw();
        this.addEventListener('click', e => {
            const o = e.target.closest('[data-pref]');
            if (o) {
                const next = prefs.set({ [o.dataset.pref]: o.dataset.v });
                this.draw();
                if (o.dataset.pref === 'motion' && next.motion !== 'off') this.querySelector('[data-demo]')?.classList.add('sr-swap');
                return;
            }
            if (e.target.closest('[data-act="reset"]')) { prefs.reset(); this.draw(); toast('Đã khôi phục giao diện mặc định', 'success'); }
        });
    }

    option(pref, key, label, current, extra = '') {
        const on = current === key;
        return `<button type="button" data-pref="${pref}" data-v="${key}" aria-pressed="${on}" data-on="${on}" class="sr-toggle sr-seg text-left">${extra}${label}</button>`;
    }

    section(title, desc, body) {
        return `<section class="${CARD}"><p class="text-base font-bold">${title}</p><p class="mb-3 text-sm text-secondary-700">${desc}</p>${body}</section>`;
    }

    draw() {
        const p = prefs.get();
        const motion = MOTIONS.map(m => `
            <button type="button" data-pref="motion" data-v="${m.key}" aria-pressed="${p.motion === m.key}" data-on="${p.motion === m.key}" class="sr-toggle sr-seg grid gap-0.5 text-left">
                <span>${m.label}</span><span class="text-xs font-medium opacity-80">${m.desc}</span></button>`).join('');
        const themes = THEMES.map(t => `
            <button type="button" data-pref="theme" data-v="${t.key}" aria-pressed="${p.theme === t.key}" data-on="${p.theme === t.key}" class="sr-toggle sr-seg flex items-center gap-2.5">
                <span class="size-6 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-black/20" style="background:${t.color}"></span>${t.label}</button>`).join('');
        const sizes = TEXT_SIZES.map(t => this.option('text', t.key, t.label, p.text)).join('');
        this.innerHTML = `
        <div class="grid gap-4 xl:grid-cols-2">
            ${this.section('Hoạt ảnh', 'Chuyển động khi mở hộp thoại, đổi tab, bật công tắc, nhấn thẻ.', `<div class="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">${motion}</div>`)}
            ${this.section('Màu chủ đạo', 'Đổi tông màu của nút, tab, viền và điểm nhấn. Chữ luôn giữ độ tương phản dễ đọc.', `<div class="grid grid-cols-2 gap-2">${themes}</div>`)}
            ${this.section('Cỡ chữ', 'Phóng to toàn bộ chữ và nút bấm cho dễ nhìn trên thiết bị này.', `<div class="grid grid-cols-3 gap-2">${sizes}</div>`)}
            <section class="${CARD}" data-demo>
                <p class="text-base font-bold">Xem thử</p>
                <p class="mb-3 text-sm text-secondary-700">Các thành phần sẽ trông như thế này với lựa chọn hiện tại.</p>
                <div class="flex flex-wrap items-center gap-3">
                    <p-button label="Lưu" icon="check" variant="solid"></p-button>
                    <p-button label="Huỷ"></p-button>
                    <button type="button" role="switch" aria-checked="true" aria-label="Công tắc thử" class="sr-switch" onclick="this.setAttribute('aria-checked', this.getAttribute('aria-checked') !== 'true')"></button>
                    <span class="rounded-full border border-ok-bd bg-ok-bg px-2.5 py-0.5 text-xs font-bold text-ok-fg">Đã thanh toán</span>
                    <span class="rounded-full border border-warn-bd bg-warn-bg px-2.5 py-0.5 text-xs font-bold text-warn-fg">Chờ xử lý</span>
                </div>
                <div class="mt-3 flex items-start gap-2.5 rounded-xl border-l-4 border-warn-ac bg-warn-bg px-4 py-3 text-sm text-warn-fg"><span class="shrink-0">${ICONS.warning}</span><div>Thẻ cảnh báo luôn có icon và viền, không chỉ dựa vào màu.</div></div>
            </section>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-3">
            <p-button data-act="reset" label="Khôi phục mặc định" icon="reload"></p-button>
            <p class="text-xs text-secondary-700">Tuỳ chọn được lưu riêng trên thiết bị này, không ảnh hưởng người dùng khác.</p>
        </div>`;
    }
}

customElements.define('app-appearance', AppearancePanel);
