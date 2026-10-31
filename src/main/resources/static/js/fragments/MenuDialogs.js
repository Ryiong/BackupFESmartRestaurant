import '../components/PrimaryButton.js';
import { openDialog, confirmDialog, bindActions, toast } from '../utils/dialog.js';
import { INPUT_CLS, esc, titleCase } from '../utils/format.js';
import { menuService } from '../services/MenuService.js';
import { ICONS } from '../icon.js';

const FIELD = 'mb-3';
const LABEL = 'mb-1.5 block text-sm font-semibold';
const BTN_ROW = 'mt-5 flex flex-wrap justidy-center gap-3';
const MAX_IMAGE = 5 * 1024 * 1024;
const ICON_BTN = 'cursor-pointer rounded-lg p-1.5 text-primary-700 transition-all hover:scale-90 hover:bg-white';

const fmtPrice = n => (Number.isFinite(n) ? n.toLocaleString('vi-VN') : '');

export function productDialog({ product = null, categories, categoryId = null }) {
    const isNew = !product;
    const selectable = categories.filter(c => c.active || (product && c.id === product.categoryId));
    const initialCat = product?.categoryId ?? categoryId ?? selectable[0]?.id;
 
    return openDialog({
        title: isNew ? 'Thêm món mới' : 'Chỉnh sửa món', width: 500,
        render(body, close) {
            let file = null;
            let previewUrl = product?.imageUrl || '';
            let objectUrl = '';
            let busy = false;
 
            body.innerHTML = `
                <form data-form novalidate>
                    <div class="${FIELD}">
                        <label for="mp-name" class="${LABEL}">Tên món <span class="text-red-600">*</span></label>
                        <input id="mp-name" maxlength="50" autocomplete="off" value="${esc(titleCase(product?.name))}" class="${INPUT_CLS}">
                    </div>
                    <div class="${FIELD}">
                        <label for="mp-price" class="${LABEL}">Giá tiền <span class="text-red-600">*</span></label>
                        <div class="relative">
                            <input id="mp-price" data-f="price" inputmode="numeric" autocomplete="off" placeholder="0" value="${product ? esc(fmtPrice(product.price)) : ''}" class="${INPUT_CLS} pr-8 text-right">
                            <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-secondary-700">đ</span>
                        </div>
                    </div>
                    <div class="${FIELD}">
                        <label for="mp-desc" class="${LABEL}">Mô tả</label>
                        <textarea id="mp-desc" rows="2" class="${INPUT_CLS} resize-none" placeholder="Không bắt buộc">${esc(product?.description)}</textarea>
                    </div>
                    <div class="${FIELD} grid grid-cols-2 gap-3">
                        <div>
                            <label for="mp-cat" class="${LABEL}">Danh mục</label>
                            <select id="mp-cat" ${isNew ? '' : 'disabled'} class="${INPUT_CLS} disabled:cursor-not-allowed disabled:opacity-60">
                                ${selectable.map(c => `<option value="${esc(c.id)}" ${c.id === initialCat ? 'selected' : ''}>${esc(titleCase(c.name))}${c.active ? '' : ' (ngưng)'}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label for="mp-status" class="${LABEL}">Trạng thái</label>
                            <select id="mp-status" class="${INPUT_CLS}">
                                <option value="ACTIVE" ${!product || product.active ? 'selected' : ''}>Đang bán</option>
                                <option value="INACTIVE" ${product && !product.active ? 'selected' : ''}>Ngưng phục vụ</option>
                            </select>
                        </div>
                    </div>
                    ${isNew ? '' : '<p class="-mt-1 mb-3 text-xs text-secondary-700">Món đã tạo không thể chuyển sang danh mục khác.</p>'}
                    <div class="${FIELD}">
                        <span class="${LABEL}">Hình ảnh minh hoạ</span>
                        <button type="button" data-act="pick-image" data-preview aria-label="Chọn ảnh"
                            class="relative block aspect-video w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-primary-200 bg-neutral-50 transition-all hover:border-primary-500"></button>
                        <input data-f="image" type="file" accept="image/jpeg,image/png,image/webp" hidden>
                        <p class="mt-1 text-xs text-secondary-700">JPG, PNG hoặc WEBP, tối đa 5MB. Tỉ lệ ảnh khuyến nghị 16/9${isNew ? '' : ' Không chọn ảnh mới thì giữ ảnh cũ.'}</p>
                    </div>
                    <p data-error class="mb-1 min-h-5 text-sm font-medium text-red-600" role="alert"></p>
                    <div class="${BTN_ROW}">
                        <p-button data-act="ok" label="${isNew ? 'Thêm món' : 'Lưu chỉnh sửa'}" icon="check" variant="solid"></p-button>
                        <p-button data-act="cancel" label="Huỷ"></p-button>
                    </div>
                </form>
                `;
 
            const $ = sel => body.querySelector(sel);
            const err = $('[data-error]');
            const okBtn = $('[data-act="ok"]');
            const preview = $('[data-preview]');
 
            const drawPreview = () => {
                preview.innerHTML = previewUrl
                    ? `<img src="${esc(previewUrl)}" alt="Ảnh món" class="size-full object-cover">
                       <span class="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-center text-xs font-semibold text-white">Đổi ảnh</span>`
                    : `<span class="flex size-full flex-col items-center justify-center gap-1 text-primary-700">${ICONS.upload}<span class="text-xs font-bold">Tải ảnh lên</span></span>`;
            };
            drawPreview();
 
            body.addEventListener('input', e => {
                if (e.target.dataset?.f !== 'price') return;
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                e.target.value = digits ? Number(digits).toLocaleString('vi-VN') : '';
            });
 
            body.addEventListener('change', e => {
                if (e.target.dataset?.f !== 'image') return;
                const f = e.target.files?.[0];
                if (!f) return;
                err.textContent = '';
                if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { err.textContent = 'Chỉ nhận ảnh JPG, PNG hoặc WEBP'; e.target.value = ''; return; }
                if (f.size > MAX_IMAGE) { err.textContent = 'Ảnh quá lớn, tối đa 5MB'; e.target.value = ''; return; }
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                objectUrl = URL.createObjectURL(f);
                file = f;
                previewUrl = objectUrl;
                drawPreview();
            });
 
            const finish = result => { if (objectUrl) URL.revokeObjectURL(objectUrl); close(result); };
 
            const submit = async () => {
                if (busy) return;
                err.textContent = '';
                const name = $('#mp-name').value.trim();
                const digits = $('#mp-price').value.replace(/\D/g, '');
                const catId = isNew ? Number($('#mp-cat').value) : product.categoryId;
                const wantActive = $('#mp-status').value === 'ACTIVE';
 
                if (!name) { err.textContent = 'Vui lòng nhập tên món'; $('#mp-name').focus(); return; }
                if (!digits) { err.textContent = 'Vui lòng nhập giá tiền'; $('#mp-price').focus(); return; }
                if (isNew && !catId) { err.textContent = 'Hãy tạo danh mục trước khi thêm món'; return; }
 
                busy = true; okBtn.toggleAttribute('disabled', true);
                const data = { name, description: $('#mp-desc').value.trim(), price: Number(digits), imageFile: file };
                try {
                    const saved = isNew
                        ? await menuService.createProduct(catId, data)
                        : await menuService.updateProduct(product.id, data);
                    const wasActive = isNew ? true : product.active;
                    if (wantActive !== wasActive) {
                        try { await menuService.setProductActive(saved?.id ?? product.id, wantActive); }
                        catch (e2) { toast(`Đã lưu món nhưng chưa đổi được trạng thái: ${e2.message || 'lỗi không xác định'}`); }
                    }
                    toast(isNew ? 'Đã thêm món' : 'Đã lưu chỉnh sửa', 'success');
                    finish(true);
                } catch (e) {
                    err.textContent = e.message || 'Không lưu được món';
                    busy = false; okBtn.toggleAttribute('disabled', false);
                }
            };
 
            $('[data-form]').addEventListener('submit', e => { e.preventDefault(); submit(); });
            bindActions(body, {
                'pick-image': () => $('[data-f="image"]').click(),
                ok: submit,
                cancel: () => finish(false),
            });
            setTimeout(() => $('#mp-name').focus(), 0);
        },
    });
}
 

export function categoryDialog({ categories, ctx }) {
    let list = categories.map(c => ({ ...c }));
    let editing = null; // { id: number|null, name, description }
    let busy = false;
 
    return openDialog({
        title: 'Chỉnh sửa danh mục', width: 440,
        render(body, close) {
            body.innerHTML = `
                <div data-list class="max-h-96 space-y-3 overflow-y-auto pr-1"></div>
                <div class="${BTN_ROW}">
                    <p-button data-act="cat-add" label="Thêm danh mục" icon="addBox"></p-button>
                    <p-button data-act="done" label="Xong" icon="check" variant="solid"></p-button>
                </div>`;
            const box = body.querySelector('[data-list]');
 
            const editForm = () => `
                <div data-edit class="space-y-2 rounded-2xl border border-primary-200 bg-white p-3">
                    <input data-f="c-name" maxlength="100" autocomplete="off" placeholder="Tên danh mục" value="${esc(editing.name)}" class="${INPUT_CLS}">
                    <input data-f="c-desc" autocomplete="off" placeholder="Mô tả (không bắt buộc)" value="${esc(editing.description)}" class="${INPUT_CLS}">
                    <p data-err class="min-h-4 text-xs font-medium text-red-600" role="alert"></p>
                    <div class="flex gap-2">
                        <p-button data-act="cat-save" label="Lưu" icon="check" variant="solid"></p-button>
                        <p-button data-act="cat-cancel" label="Huỷ"></p-button>
                    </div>
                </div>`;
 
            const row = c => c.id === editing?.id ? editForm() : `
                <div class="flex items-center gap-3 rounded-2xl bg-neutral-100 px-4 py-3 ${c.active ? '' : 'opacity-70'}">
                    <div class="min-w-0 flex-1">
                        <p class="line-clamp-1 font-bold text-primary-700">${esc(titleCase(c.name))}${c.active ? '' : ' <span class="text-xs font-semibold text-secondary-700">(ngưng)</span>'}</p>
                        ${c.description ? `<p class="line-clamp-1 text-xs text-secondary-700">${esc(c.description)}</p>` : ''}
                    </div>
                    <button type="button" data-act="cat-edit" data-id="${esc(c.id)}" class="${ICON_BTN}" title="Đổi tên" aria-label="Chỉnh sửa ${esc(titleCase(c.name))}">${ICONS.edit}</button>
                    <button type="button" data-act="cat-toggle" data-id="${esc(c.id)}" class="${ICON_BTN}" title="${c.active ? 'Ngừng dùng' : 'Dùng lại'}" aria-label="${c.active ? 'Ngừng dùng' : 'Dùng lại'} ${esc(titleCase(c.name))}">${c.active ? ICONS.eye : ICONS.eyeOff}</button>
                </div>`;
 
            const draw = () => {
                box.innerHTML = (list.length || editing
                    ? list.map(row).join('') + (editing && editing.id === null ? editForm() : '')
                    : '<p class="py-10 text-center text-sm text-secondary-700">Chưa có danh mục nào. Nhấn “Thêm danh mục” để bắt đầu.</p>');
                const input = box.querySelector('[data-f="c-name"]');
                if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
            };
 
            const showErr = msg => { const p = box.querySelector('[data-err]'); if (p) p.textContent = msg; };
            const byId = id => list.find(c => String(c.id) === String(id));
 
            body.addEventListener('input', e => {
                const f = e.target.dataset?.f;
                if (!editing) return;
                if (f === 'c-name') editing.name = e.target.value;
                else if (f === 'c-desc') editing.description = e.target.value;
            });
            body.addEventListener('keydown', e => {
                if (e.key === 'Enter' && e.target.dataset?.f === 'c-name') { e.preventDefault(); body.querySelector('[data-act="cat-save"]')?.click(); }
            });
 
            const guard = async fn => {
                if (busy) return;
                busy = true;
                try { await fn(); } finally { busy = false; }
            };
 
            bindActions(body, {
                'cat-add': () => { editing = { id: null, name: '', description: '' }; draw(); box.scrollTop = box.scrollHeight; },
                'cat-edit': el => {
                    const c = byId(el.dataset.id);
                    if (c) { editing = { id: c.id, name: titleCase(c.name), description: c.description }; draw(); }
                },
                'cat-cancel': () => { editing = null; draw(); },
                'cat-save': () => guard(async () => {
                    const name = editing.name.trim();
                    if (!name) return showErr('Vui lòng nhập tên danh mục');
                    const payload = { name, description: editing.description.trim() };
                    try {
                        if (editing.id === null) {
                            list.push(await menuService.createCategory(payload));
                        } else {
                            const saved = await menuService.updateCategory(editing.id, payload);
                            list = list.map(c => (c.id === editing.id ? { ...c, ...saved, active: c.active } : c));
                        }
                        ctx.dirty = true;
                        editing = null;
                        draw();
                    } catch (e) { showErr(e.message || 'Không lưu được danh mục'); }
                }),
                'cat-toggle': el => guard(async () => {
                    const c = byId(el.dataset.id);
                    if (!c) return;
                    if (c.active) {
                        const ok = await confirmDialog({
                            title: 'Ngừng dùng danh mục',
                            message: `Xác nhận ngừng dùng danh mục “${titleCase(c.name)}”? Món thuộc danh mục này sẽ không hiện khi gọi món. Bạn có thể bật lại bất cứ lúc nào.`,
                            confirmLabel: 'Ngừng dùng', confirmIcon: 'pause', variant: 'danger',
                        });
                        if (!ok) return;
                    }
                    try {
                        await menuService.setCategoryActive(c.id, !c.active);
                        c.active = !c.active;
                        ctx.dirty = true;
                        draw();
                    } catch (e) { toast(e.message || 'Không đổi được trạng thái danh mục'); }
                }),
                done: () => close(true),
            });
 
            draw();
        },
    });
}