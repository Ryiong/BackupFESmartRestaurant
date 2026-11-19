// Bước 0 — Cửa hàng & vị trí chấm công: toạ độ cửa hàng + bán kính cho phép chấm công (PUT /shop/{id}/location).

import {
    getCurrentShop, getShopLocation, updateShopLocation, validateLocation, STATUS_LABEL,
    RADIUS_DEFAULT, RADIUS_MAX, distanceMeters,
} from '../../services/ShopService.js';
import { getPosition } from '../../services/AttendanceService.js';
import { loadLeaflet } from '../../services/Leaflet.js';
import { HrPanel, esc, INPUT_CLS, CARD, chip, field, notice, bindActions, toast } from './ui.js';

const STATUS_TONE = { PENDING: 'amber', ACTIVE: 'green', LOCKED: 'red' };

const DEFAULT_CENTER = [10.7769, 106.7009]; // TP.HCM, chỉ dùng khi cửa hàng chưa có vị trí
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

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
                        <p-button data-act="here" label="Dùng vị trí hiện tại của tôi" icon="location"></p-button>
                        <p-button data-act="save" label="Lưu vị trí" icon="check" variant="solid"></p-button>
                    </div>
                </form>
                <div class="mt-4">
                    <div data-maperr class="mb-2"></div>
                    <div data-gmap class="z-0 h-72 w-full rounded-xl border border-primary-100 bg-neutral-50"></div>
                    <p class="mt-1.5 text-xs text-secondary-700">Bấm vào bản đồ hoặc <b>kéo ghim</b> để chọn vị trí cửa hàng. Vòng tròn xanh là vùng cho phép chấm công.</p>
                    <a data-maplink class="mt-1 hidden text-xs font-semibold text-primary-700 underline" target="_blank" rel="noopener">Mở bản đồ lớn</a>
                </div>
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
        this.querySelector('[data-range]').value = Math.min(500, Number(v.attendanceRadius) || RADIUS_DEFAULT);
        const lat = Number(v.latitude), lng = Number(v.longitude);
        const ok = v.latitude !== '' && v.longitude !== '' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
        const link = this.querySelector('[data-maplink]');
        link.classList.toggle('hidden', !ok);
        if (ok) link.href = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
        this.drawMap(ok ? [lat, lng] : null, Number(v.attendanceRadius) || 0);
        this.querySelector('[data-hint]').textContent = this.myPos && ok
            ? `Bạn đang cách vị trí này khoảng ${Math.round(distanceMeters({ latitude: lat, longitude: lng }, this.myPos))} m.` : '';
    }

    /** Khởi tạo bản đồ Leaflet một lần; lỗi thì chỉ báo, vẫn nhập toạ độ bằng tay được. */
    async initMap() {
        if (this.map || this._mapBusy) return;
        const errBox = this.querySelector('[data-maperr]');
        this._mapBusy = true;
        try {
            const L = await loadLeaflet();
            if (this.map || !this.isConnected) return;
            const loc = this.state.loc;
            this.map = L.map(this.querySelector('[data-gmap]'), { center: loc ? [loc.latitude, loc.longitude] : DEFAULT_CENTER, zoom: loc ? 18 : 15 });
            let failed = 0;
            L.tileLayer(TILES, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' })
                .on('tileerror', () => {
                    if (++failed === 3) errBox.innerHTML = notice('Không tải được ô bản đồ từ OpenStreetMap (có thể bị chặn mạng). Bạn vẫn nhập toạ độ bằng tay hoặc bấm “Dùng vị trí hiện tại của tôi”.');
                })
                .addTo(this.map);
            this.L = L;
            this.circle = L.circle(DEFAULT_CENTER, { radius: 0, color: '#16a34a', weight: 2, fillColor: '#16a34a', fillOpacity: 0.15, interactive: false });
            this.map.on('click', e => this.pick(e.latlng));
            setTimeout(() => this.map?.invalidateSize(), 0);
            this.sync();
        } catch (e) {
            errBox.innerHTML = notice(`${esc(e.message)} (kiểm tra kết nối tới unpkg.com). Bạn vẫn nhập toạ độ bằng tay được.`);
            this.querySelector('[data-gmap]').classList.add('hidden');
        } finally { this._mapBusy = false; }
    }

    /** Người dùng chọn điểm trên bản đồ -> ghi vào ô toạ độ. */
    pick(latlng) {
        const f = this.querySelector('[data-form]').elements;
        f.latitude.value = latlng.lat.toFixed(6);
        f.longitude.value = latlng.lng.toFixed(6);
        this._touched = true; this._fromMap = true;
        this.querySelector('[data-error]').textContent = '';
        this.sync();
        this._fromMap = false;
    }

    drawMap(pos, radius) {
        if (!this.map) { this.initMap(); return; }
        if (!pos) { this.marker?.remove(); this.marker = null; this.circle.remove(); return; }
        if (!this.marker) {
            this.marker = this.L.marker(pos, { draggable: true, title: 'Kéo để chọn vị trí cửa hàng' }).addTo(this.map);
            this.marker.on('drag', e => this.circle.setLatLng(e.latlng));
            this.marker.on('dragend', () => this.pick(this.marker.getLatLng()));
        } else this.marker.setLatLng(pos);
        this.circle.setLatLng(pos).setRadius(radius);
        if (radius > 0) this.circle.addTo(this.map); else this.circle.remove();
        if (!this._fromMap && !this.map.getBounds().contains(pos)) this.map.panTo(pos);
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
