import '../components/PrimaryButton.js';
import '../components/TableCard.js';
import { openDialog, confirmDialog, bindActions, toast } from '../utils/dialog.js';
import { esc, money, INPUT_CLS, titleCase } from '../utils/format.js';
import { areaService } from '../services/AreaService.js';

const BTN_ROW = 'mt-6 flex flex-wrap justify-center gap-3';

export function guestsDialog({ tableName, max }) {
    return openDialog({
        title: `Sử dụng ${titleCase(tableName)}`, width: 360,
        render(body, close) {
            body.innerHTML = `
                <label for="g-guests" class="mb-1.5 block text-sm font-semibold">Số khách</label>
                <input id="g-guests" type="number" min="1" max="${max}" value="${Math.min(2, max)}" class="${INPUT_CLS}">
                <p class="mt-1 text-xs text-secondary-700">Tối đa ${max} khách</p>
                <div class="${BTN_ROW}">
                    <p-button data-act="ok" label="Xác nhận" icon="check" variant="solid"></p-button>
                    <p-button data-act="cancel" label="Huỷ"></p-button>
                </div>`;
            const input = body.querySelector('input');
            const submit = () => {
                const n = Number(input.value);
                if (!Number.isInteger(n) || n < 1 || n > max) return toast(`Số khách phải từ 1 đến ${max}`);
                close(n);
            };
            input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
            bindActions(body, { ok: submit, cancel: () => close() });
            setTimeout(() => input.select(), 0);
        },
    });
}

export function pickTableDialog({ title, subtitle, tables, reasonFor }) {
    return openDialog({
        title, width: 720,
        render(body, close) {
            let picked = null;
            const cards = tables.map(t => {
                const reason = reasonFor(t);
                return `<table-card data-act="pick" data-id="${esc(t.id)}" name="${esc(titleCase(t.name))}" capacity="${t.capacity}"
                    status="${t.status}" variant="pick" ${reason ? `disabled note="${esc(reason)}"` : ''}></table-card>`;
            }).join('');
            body.innerHTML = `
                <p class="mb-3 text-sm font-bold">${esc(subtitle)}</p>
                <div data-grid class="grid max-h-80 min-h-40 grid-cols-2 content-start gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4">
                    ${cards || '<p class="col-span-full py-10 text-center text-sm text-secondary-700">Không có bàn nào khác trong khu vực này.</p>'}
                </div>
                <div class="${BTN_ROW}">
                    <p-button data-act="ok" label="Xác nhận" icon="check" variant="solid" disabled></p-button>
                    <p-button data-act="cancel" label="Huỷ"></p-button>
                </div>`;
            const ok = body.querySelector('[data-act="ok"]');
            bindActions(body, {
                pick: el => {
                    picked = picked === el.dataset.id ? null : el.dataset.id;
                    body.querySelectorAll('table-card').forEach(c => c.toggleAttribute('selected', c.dataset.id === picked));
                    ok.toggleAttribute('disabled', !picked);
                },
                ok: () => close(picked),
                cancel: () => close(),
            });
        },
    });
}

export function orderDialog({ tableName, menu }) {
    return openDialog({
        title: `Đặt món — ${tableName}`, width: 520,
        render(body, close) {
            const qty = Object.fromEntries(menu.map(m => [m.id, 0]));
            const total = () => menu.reduce((s, m) => s + m.price * qty[m.id], 0);
            const count = () => Object.values(qty).reduce((s, n) => s + n, 0);

            body.innerHTML = `
                <ul class="max-h-80 divide-y divide-primary-100 overflow-y-auto pr-1">
                    ${menu.map(m => `
                    <li class="flex items-center justify-between gap-3 py-2">
                        <div class="min-w-0"><p class="line-clamp-1 text-sm font-bold">${esc(titleCase(m.name))}</p><p class="text-xs text-secondary-700">${money(m.price)}</p></div>
                        <div class="flex items-center gap-2">
                            <button type="button" data-act="dec" data-id="${m.id}" aria-label="Giảm ${esc(titleCase(m.name))}" class="flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-primary-200 text-primary-700 transition-all hover:scale-90">−</button>
                            <span data-qty="${m.id}" class="w-6 text-center text-sm font-bold">0</span>
                            <button type="button" data-act="inc" data-id="${m.id}" aria-label="Thêm ${esc(titleCase(m.name))}" class="flex size-7 cursor-pointer items-center justify-center rounded-full border-2 border-primary-700 bg-primary-700 text-white transition-all hover:scale-90">+</button>
                        </div>
                    </li>`).join('')}
                </ul>
                <div class="mt-3 flex items-center justify-between border-t border-primary-200 pt-3">
                    <span class="font-bold">Tạm tính</span><b data-total class="text-lg text-primary-700">0 đ</b>
                </div>
                <div class="${BTN_ROW}">
                    <p-button data-act="ok" label="Thêm vào bàn" icon="check" variant="solid" disabled></p-button>
                    <p-button data-act="cancel" label="Huỷ"></p-button>
                </div>`;

            const ok = body.querySelector('[data-act="ok"]');
            const sync = id => {
                body.querySelector(`[data-qty="${id}"]`).textContent = qty[id];
                body.querySelector('[data-total]').textContent = money(total());
                ok.toggleAttribute('disabled', count() === 0);
            };
            const step = (id, d) => { qty[id] = Math.max(0, Math.min(99, qty[id] + d)); sync(id); };
            bindActions(body, {
                inc: el => step(el.dataset.id, 1),
                dec: el => step(el.dataset.id, -1),
                ok: () => close(menu.filter(m => qty[m.id] > 0).map(m => ({ id: m.id, name: m.name, price: m.price, qty: qty[m.id] }))),
                cancel: () => close(),
            });
        },
    });
}

const CAPACITIES = [2, 4, 6, 8, 10, 12, 16, 20];


export function areaEditorDialog({ area }) {
    const isNew = !area;
    const draft = {
        id: area?.id,
        name: titleCase(area?.name),
        tables: (area?.tables ?? []).map(t => ({ _k: t.id, id: t.id, name: t.name, capacity: t.capacity, status: t.status })),
    };
    let editing = null;
    let seq = 0;
    let busy = false;

    return openDialog({
        title: isNew ? 'Thêm mới khu vực' : 'Chỉnh sửa khu vực', width: 800,
        render(body, close) {
            body.innerHTML = `
                <div class="flex items-center gap-3">
                    <label for="ae-name" class="shrink-0 text-sm font-bold">Tên khu vực</label>
                    <input id="ae-name" data-f="area-name" maxlength="60" autocomplete="off" value="${esc(draft.name)}" placeholder="Ví dụ: Sân vườn" class="${INPUT_CLS}">
                </div>
                <h3 class="mb-2 mt-4 text-sm font-bold">Sơ đồ bàn</h3>
                <div data-grid class="grid max-h-72 min-h-28 grid-cols-2 content-start gap-3 overflow-y-auto p-1 sm:grid-cols-3 md:grid-cols-4"></div>
                <div data-form></div>
                <div class="mt-5 flex flex-wrap items-center justify-end gap-2.5">
                    <p-button data-act="add-table" label="Thêm bàn" icon="addBox" variant="solid"></p-button>
                    ${isNew ? '' : '<p-button data-act="pause-area" label="Tạm ngưng" icon="pause"></p-button>'}
                    ${isNew ? '' : '<p-button data-act="delete-area" label="Xoá" icon="delete" variant="danger"></p-button>'}
                    <p-button data-act="save-area" label="Xác nhận" icon="check" variant="solid"></p-button>
                    <p-button data-act="cancel" label="Huỷ"></p-button>
                </div>`;

            const grid = body.querySelector('[data-grid]');
            const form = body.querySelector('[data-form]');
            const byKey = k => draft.tables.find(t => t._k === k);
            const dup = (name, exceptKey) => draft.tables.some(t => t._k !== exceptKey && t.name.trim().toLowerCase() === name.trim().toLowerCase());

            const drawGrid = () => {
                grid.innerHTML = draft.tables.length
                    ? draft.tables.map(t => `<table-card data-key="${esc(t._k)}" name="${esc(titleCase(t.name))}" capacity="${t.capacity}" status="${t.status}" variant="edit"></table-card>`).join('')
                    : '<p class="col-span-full py-8 text-center text-sm text-secondary-700">Chưa có bàn nào. Nhấn “Thêm bàn” để bắt đầu.</p>';
            };

            const drawForm = () => {
                if (!editing) { form.innerHTML = ''; return; }
                const caps = CAPACITIES.includes(editing.capacity) ? CAPACITIES : [...CAPACITIES, editing.capacity].sort((a, b) => a - b);
                form.innerHTML = `
                    <div class="ml-auto mr-auto mt-4 max-w-md rounded-2xl border border-primary-200 bg-neutral-50 p-4">
                        <p class="mb-3 text-center text-sm font-bold">${editing.isNew ? 'Thêm bàn mới' : 'Chi tiết bàn đang xem'}</p>
                        <div class="grid grid-cols-[88px_1fr] items-center gap-2.5">
                            <label for="tf-name" class="text-sm font-semibold">Tên bàn</label>
                            <input id="tf-name" data-f="t-name" maxlength="30" autocomplete="off" value="${esc(editing.name)}" class="${INPUT_CLS}">
                            <label for="tf-cap" class="text-sm font-semibold">Sức chứa</label>
                            <select id="tf-cap" data-f="t-cap" class="${INPUT_CLS}">
                                ${caps.map(c => `<option value="${c}" ${c === editing.capacity ? 'selected' : ''}>${c} khách</option>`).join('')}
                            </select>
                        </div>
                        <div class="mt-4 flex flex-wrap gap-2.5">
                            <p-button data-act="table-save" label="Lưu" icon="check" variant="solid"></p-button>
                            ${editing.isNew ? '' : '<p-button data-act="table-delete" label="Xoá" icon="delete" variant="danger"></p-button>'}
                            <p-button data-act="table-cancel" label="Huỷ"></p-button>
                        </div>
                    </div>`;
                form.querySelector('[data-f="t-name"]').focus();
            };

            const removeTable = key => {
                const t = byKey(key);
                if (!t) return;
                if (t.status !== 'empty') return toast(`${titleCase(t.name)} đang được sử dụng hoặc đã đặt trước, không thể xoá`);
                draft.tables = draft.tables.filter(x => x._k !== key);
                if (editing?.key === key) editing = null;
                drawGrid(); drawForm();
            };

            body.addEventListener('input', e => {
                const f = e.target.dataset?.f;
                if (f === 'area-name') draft.name = e.target.value;
                else if (f === 't-name' && editing) editing.name = e.target.value;
                else if (f === 't-cap' && editing) editing.capacity = Number(e.target.value);
            });
            body.addEventListener('keydown', e => {
                if (e.key === 'Enter' && e.target.dataset?.f === 't-name') {
                    e.preventDefault();
                    body.querySelector('[data-act="table-save"]')?.click();
                }
            });

            const guard = async fn => {
                if (busy) return;
                busy = true;
                try { await fn(); }
                catch (err) { toast(err.message || 'Có lỗi xảy ra'); }
                finally { busy = false; }
            };

            bindActions(body, {
                'add-table': () => {
                    const n = String(draft.tables.length + 1).padStart(2, '0');
                    editing = { key: null, isNew: true, name: `Bàn ${n}`, capacity: 4 };
                    drawForm();
                },
                'edit-table': el => {
                    const t = byKey(el.dataset.key);
                    if (t) {
                        editing = {
                            key: t._k,
                            isNew: false,
                            name: titleCase(t.name),
                            capacity: t.capacity
                        };
                        drawForm();
                    }
                },
                'delete-table': el => removeTable(el.dataset.key),
                'table-delete': () => removeTable(editing?.key),
                'table-cancel': () => { editing = null; drawForm(); },
                'table-save': () => {
                    const name = editing.name.trim();
                    if (!name) return toast('Vui lòng nhập tên bàn');
                    if (dup(name, editing.key)) return toast(`Tên bàn "${name}" đã tồn tại trong khu vực`);
                    if (editing.isNew) draft.tables.push({ _k: `new-${++seq}`, name, capacity: editing.capacity, status: 'empty' });
                    else Object.assign(byKey(editing.key), { name, capacity: editing.capacity });
                    editing = null; drawGrid(); drawForm();
                },
                'save-area': () => guard(async () => {
                    if (!draft.name.trim()) return toast('Vui lòng nhập tên khu vực');
                    const saved = await areaService.saveArea({
                        id: draft.id,
                        name: draft.name.trim(),
                        tables: draft.tables.map(t => ({ id: t.id, name: t.name, capacity: t.capacity })),
                    });
                    toast(isNew ? 'Đã thêm khu vực' : 'Đã lưu thay đổi', 'success');
                    close({ saved: saved.id });
                }),
                'pause-area': () => guard(async () => {
                    const yes = await confirmDialog({ title: 'Tạm ngưng khu vực', message: 'Xác nhận tạm ngưng sử dụng khu vực này?' });
                    if (!yes) return;
                    await areaService.setAreaActive(draft.id, false);
                    toast('Đã tạm ngưng khu vực', 'success');
                    close({ paused: draft.id });
                }),
                'delete-area': () => guard(async () => {
                    const yes = await confirmDialog({
                        title: 'Xoá khu vực', message: 'Xác nhận xoá khu vực và toàn bộ bàn trong khu vực này hay không?',
                        confirmLabel: 'Xoá', confirmIcon: 'delete', variant: 'danger',
                    });
                    if (!yes) return;
                    await areaService.deleteArea(draft.id);
                    toast('Đã xoá khu vực', 'success');
                    close({ deleted: draft.id });
                }),
                cancel: () => close(),
            });

            drawGrid();
            if (isNew) body.querySelector('#ae-name').focus();
        },
    });
}
