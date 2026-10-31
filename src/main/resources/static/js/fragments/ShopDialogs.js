import '../components/PrimaryButton.js';
import { openDialog, bindActions, toast } from '../utils/dialog.js';
import { INPUT_CLS, esc, titleCase } from '../utils/format.js';
import { createShop, updateShop } from '../services/ShopService.js';

const FIELD = 'mb-3';
const LABEL = 'mb-1.5 block text-sm font-semibold';
const hhmm = t => (t ? String(t).slice(0, 5) : '');

export function shopFormDialog({ shop = null } = { }) {
    const isNew = !shop;
    const val = {
        name: shop ? titleCase(shop.name) : '',
        address: shop?.address ?? '',
        phoneNumber: shop?.phoneNumber ?? '',
        openTime: shop ? hhmm(shop.openTime) : '08:00',
        closeTime: shop ? hhmm(shop.closeTime) : '22:00',
    };
    return openDialog({
        title: isNew ? 'Tạo cửa hàng mới' : 'Chỉnh sửa cửa hàng', width: 480,
        render(body, close) {
            body.innerHTML = `
                <form data-form novalidate>
                    <div class="${FIELD}">
                        <label for="sh-name" class="${LABEL}">Tên cửa hàng <span class="text-red-600">*</span></label>
                        <input id="sh-name" name="name" maxlength="100" required autocomplete="off" placeholder="Ví dụ: Quán Ngon" class="${INPUT_CLS}">
                    </div>
                    <div class="${FIELD}">
                        <label for="sh-address" class="${LABEL}">Địa chỉ</label>
                        <input id="sh-address" name="address" maxlength="255" autocomplete="street-address" placeholder="Số nhà, đường, quận/huyện" class="${INPUT_CLS}">
                    </div>
                    <div class="${FIELD}">
                        <label for="sh-phone" class="${LABEL}">Số điện thoại</label>
                        <input id="sh-phone" name="phoneNumber" type="tel" inputmode="tel" maxlength="20" autocomplete="tel" placeholder="0901234567" class="${INPUT_CLS}">
                    </div>
                    <div class="${FIELD} grid grid-cols-2 gap-3">
                        <div>
                            <label for="sh-open" class="${LABEL}">Giờ mở cửa</label>
                            <input id="sh-open" name="openTime" type="time" value="08:00" class="${INPUT_CLS}">
                        </div>
                        <div>
                            <label for="sh-close" class="${LABEL}">Giờ đóng cửa</label>
                            <input id="sh-close" name="closeTime" type="time" value="22:00" class="${INPUT_CLS}">
                        </div>
                    </div>
                    <p data-error class="mb-1 min-h-5 text-sm font-medium text-red-600" role="alert"></p>
                    <p class="text-xs text-secondary-700">Cửa hàng mới ở trạng thái <b>Chờ duyệt</b> cho đến khi quản trị viên phê duyệt.</p>
                    <div class="mt-5 flex flex-wrap justify-center gap-3">
                        <p-button data-act="ok" label="Tạo cửa hàng" icon="check" variant="solid"></p-button>
                        <p-button data-act="cancel" label="Huỷ"></p-button>
                    </div>
                </form>`;

            const form = body.querySelector('[data-form]');
            const err = body.querySelector('[data-error]');
            const okBtn = body.querySelector('[data-act="ok"]');
            let busy = false;

            const submit = async () => {
                if (busy) return;
                const d = Object.fromEntries(new FormData(form));
                const name = d.name.trim();
                err.textContent = '';
                if (!name) {
                    err.textContent = 'Vui lòng nhập tên cửa hàng';
                    form.name.focus();
                    return;
                }
                if (d.openTime && d.closeTime && d.openTime === d.closeTime) {
                    err.textContent = 'Giờ mở cửa và giờ đóng cửa không được trùng nhau';
                    return;
                }
                busy = true; okBtn.toggleAttribute('disabled', true);
                try {
                    const payload = await createShop({
                        name,
                        address: d.address.trim() || null,
                        phoneNumber: d.phoneNumber.trim() || null,
                        openTime: d.openTime || null,
                        closeTime: d.closeTime || null,
                    });
                    const saved = isNew ? await createShop(payload) : await updateShop(shop.id, payload);
                    toast(isNew ? 'Đã tạo cửa hàng' : 'Đã lưu thay đổi cửa hàng', 'success');
                    close(saved);
                } catch (e) {
                    err.textContent = e.message || (isNew ? 'Không tạo được cửa hàng' : 'Không lưu được cửa hàng');
                    busy = false; okBtn.toggleAttribute('disabled', false);
                }
            };

            form.addEventListener('submit', e => { e.preventDefault(); submit(); });
            bindActions(body, { ok: submit, cancel: () => close() });
            setTimeout(() => form.name.focus(), 0);
        },
    });
}

export const shopCreateDialog = () => shopFormDialog();
export const shopEditDialog = shop => shopFormDialog({ shop });
