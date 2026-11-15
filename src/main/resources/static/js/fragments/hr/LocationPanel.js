// Bước 0 — Cửa hàng & vị trí chấm công: toạ độ cửa hàng + bán kính cho phép chấm công (PUT /shop/{id}/location).

import {
    getCurrentShop, getShopLocation, updateShopLocation, validateLocation, STATUS_LABEL,
    RADIUS_DEFAULT, RADIUS_MAX, distanceMeters,
} from '../../services/ShopService.js';
import { getPosition } from '../../services/AttendanceService.js';
import { HrPanel, esc, INPUT_CLS, CARD, chip, field, notice, bindActions, toast } from './ui.js';

const STATUS_TONE = { PENDING: 'amber', ACTIVE: 'green', LOCKED: 'red' };

/** Bản đồ xem trước bằng OpenStreetMap (iframe, không cần thư viện/API key). */
const mapUrl = (lat, lng) => {
    const d = 0.0015;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d},${lng + d},${lat + d}&layer=mapnik&marker=${lat},${lng}`;
};

class LocationPanel extends HrPanel {
    state = { shop: null, loc: null };

    build() {
        this.innerHTML = `
        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section class="${CARD}" data-info></section>
            <section class="${CARD}">
                <h3 class="mb-1 font-bold">Vị trí chấm công</h3>
                <p class="mb-4 text-sm text-secondary-700">Nhân viên chỉ chấm công được khi điện thoại nằm trong bán kính này tính từ cửa hàng.</p>
                <div data-banner class="mb-4"></div>
                <form data-form class="grid gap-4" novalidate>
                    <div class="grid gap-3 sm:grid-cols-2">
                        ${field('Vĩ độ (latitude)', `<input name="latitude" inputmode="decimal" autocomplete="off" placeholder="21.0278" class="${INPUT_CLS}">`)}
                        ${field('Kinh độ (longitude)', `<input name="longitude" inputmode="decimal" autocomplete="off" placeholder="105.8342" class="${INPUT_CLS}">`)}
                    </div>
                    <div class="grid gap-2">
                        ${field('Bán kính chấm công (mét)', `<input name="attendanceRadius" type="number" min="10" max="${RADIUS_MAX}" step="5" inputmode="numeric" class="${INPUT_CLS}">`,
                            'Nên đặt 50–150 m. GPS điện thoại trong nhà thường lệch 10–30 m.')}
                        <input data-range type="range" min="10" max="500" step="5" aria-label="Kéo để chọn bán kính" class="w-full cursor-pointer accent-primary-600">
                    </div>
                    <p data-hint class="min-h-5 text-sm text-secondary-700"></p>
                    <p data-error role="alert" class="min-h-5 text-sm font-semibold text-red-600"></p>
                    <div class="flex flex-wrap gap-3">
                        <p-button data-act="here" label="Dùng vị trí hiện tại của tôi" icon="fingerprint"></p-button>
                        <p-button data-act="save" label="Lưu vị trí" icon="check" variant="solid"></p-button>
                    </div>
                </form>
                <div data-map class="mt-4"></div>
            </section>
        </div>`;
    }

    async load() {
        const shop = await getCurrentShop();
        this.state = { shop, loc: getShopLocation(shop) };
    }

    draw() {
        const { shop, loc } = this.state;
        const info = this.querySelector('[data-info]');
        if (!shop) {
            info.innerHTML = '<p class="text-sm">Tài khoản chưa có cửa hàng. Hãy tạo cửa hàng ở trang Tổng quan.</p>';
            this.querySelector('[data-form]').classList.add('hidden');
            return;
        }
        this.querySelector('[data-form]').classList.remove('hidden');
        const st = STATUS_LABEL[shop.status];
        const row = (k, v) => `<div class="flex justify-between gap-4 border-t border-primary-50 py-2 text-sm"><dt class="text-secondary-700">${k}</dt><dd class="text-right font-semibold">${v || '—'}</dd></div>`;
        info.innerHTML = `
            <div class="mb-2 flex items-center justify-between gap-2"><h3 class="font-bold">Thông tin cửa hàng</h3>
                ${chip(st?.text ?? shop.status, STATUS_TONE[shop.status] ?? 'gray')}</div>
            <dl>${row('Tên', esc(shop.name))}${row('Địa chỉ', esc(shop.address))}${row('Điện thoại', esc(shop.phoneNumber))}
                ${row('Giờ mở – đóng', `${esc(String(shop.openTime ?? '').slice(0, 5))} – ${esc(String(shop.closeTime ?? '').slice(0, 5))}`)}</dl>
            ${shop.statusReason ? `<p class="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">Lý do: ${esc(shop.statusReason)}</p>` : ''}
            <div class="mt-4"><p-button data-act="edit" label="Sửa thông tin" icon="edit"></p-button></div>`;

        this.querySelector('[data-banner]').innerHTML = !loc
            ? notice('Cửa hàng <b>chưa có vị trí</b>. Chưa cấu hình thì nhân viên không chấm công được. Hãy đứng tại quán rồi bấm “Dùng vị trí hiện tại của tôi”.')
            : loc.source === 'local' ? notice('Đây là giá trị bạn đã lưu trên trình duyệt này (máy chủ chưa trả lại vị trí đã lưu). Bấm “Lưu vị trí” nếu muốn ghi lại.', 'info') : '';

        const f = this.querySelector('[data-form]').elements;
        if (!this._touched) {
            f.latitude.value = loc?.latitude ?? '';
            f.longitude.value = loc?.longitude ?? '';
            f.attendanceRadius.value = loc?.attendanceRadius ?? RADIUS_DEFAULT;
        }
        this.sync();
    }

    read() {
        const f = this.querySelector('[data-form]').elements;
        return { latitude: f.latitude.value.trim().replace(',', '.'), longitude: f.longitude.value.trim().replace(',', '.'), attendanceRadius: f.attendanceRadius.value };
    }

    sync() {
        const v = this.read();
        const f = this.querySelector('[data-form]').elements;
        this.querySelector('[data-range]').value = Math.min(500, Number(v.attendanceRadius) || RADIUS_DEFAULT);
        const lat = Number(v.latitude), lng = Number(v.longitude);
        const ok = v.latitude !== '' && v.longitude !== '' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        this.querySelector('[data-map]').innerHTML = ok ? `
            <iframe title="Bản đồ vị trí cửa hàng" loading="lazy" referrerpolicy="no-referrer" class="h-56 w-full rounded-xl border border-primary-100" src="${mapUrl(lat, lng)}"></iframe>
            <a class="mt-1 inline-block text-xs font-semibold text-primary-700 underline" target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}">Mở bản đồ lớn</a>` : '';
        this.querySelector('[data-hint]').textContent = this.myPos && ok
            ? `Bạn đang cách vị trí này khoảng ${Math.round(distanceMeters({ latitude: lat, longitude: lng }, this.myPos))} m.` : '';
        void f;
    }

    onInput(e) {
        if (e.target.matches('[data-range]')) this.querySelector('[data-form]').elements.attendanceRadius.value = e.target.value;
        if (e.target.closest('[data-form]')) { this._touched = true; this.querySelector('[data-error]').textContent = ''; this.sync(); }
    }

    actions() {
        return {
            edit: async () => {
                const { shopEditDialog } = await import('../ShopDialogs.js');
                if (await shopEditDialog(this.state.shop)) { window.dispatchEvent(new CustomEvent('hr:changed')); this.reload(); }
            },
            here: async el => {
                const err = this.querySelector('[data-error]');
                err.textContent = ''; el.setAttribute('disabled', '');
                try {
                    const p = await getPosition();
                    this.myPos = p; this._touched = true;
                    const f = this.querySelector('[data-form]').elements;
                    f.latitude.value = p.latitude.toFixed(6); f.longitude.value = p.longitude.toFixed(6);
                    this.sync();
                } catch (e) { err.textContent = e.message; } finally { el.removeAttribute('disabled'); }
            },
            save: async el => {
                const err = this.querySelector('[data-error]');
                const v = this.read();
                const msg = validateLocation(v);
                if (msg) { err.textContent = msg; return; }
                if (el.hasAttribute('disabled')) return;
                el.setAttribute('disabled', '');
                try {
                    await updateShopLocation(this.state.shop.id, v);
                    this._touched = false;
                    toast('Đã lưu vị trí chấm công', 'success');
                    window.dispatchEvent(new CustomEvent('hr:changed'));
                    await this.reload();
                } catch (e) {
                    err.textContent = e.noAccess ? 'Bạn chưa có quyền đặt vị trí cửa hàng (PERM_SHOP_SET_LOCATION).' : (e.message || 'Không lưu được vị trí');
                } finally { el.removeAttribute('disabled'); }
            },
        };
    }
}

customElements.define('hr-location', LocationPanel);
void bindActions;
