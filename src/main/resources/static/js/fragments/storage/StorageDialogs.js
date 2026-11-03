import '../../components/PrimaryButton.js';
import { openDialog, confirmDialog, bindActions, toast } from '../../utils/dialog.js';
import { INPUT_CLS, esc, titleCase } from '../../utils/format.js';
import { storageService, INGREDIENT_TYPES, DOC_TYPES, DOC_STATUS } from '../../services/StorageService.js';
import { num, parseNum, fmtDateTime, DOC_STATUS_CLS, ICON_BTN } from './StorageTemplates.js';

const FIELD = 'mb-3';
const LABEL = 'mb-1.5 block text-sm font-semibold';
const HINT = 'mt-1 text-xs text-secondary-700';
const BTN_ROW = 'mt-5 flex flex-wrap justify-center gap-3';
const UNITS = ['kg', 'g', 'lít', 'ml', 'cái', 'quả', 'bó', 'gói', 'hộp', 'chai', 'lon'];

/** Giá trị đưa vào ô nhập: số thuần, dấu thập phân là "." (num() dùng "1.500" kiểu vi-VN nên parseNum sẽ đọc thành 1,5). */
const plain = n => String(Number(n) || 0);

/* ───────────────────────── Nguyên liệu ───────────────────────── */

export function ingredientDialog({ ingredient = null }) {
    const isNew = !ingredient;
    const type0 = ingredient?.type ?? 'FRESH';

    return openDialog({
        title: isNew ? 'Thêm nguyên liệu mới' : 'Chỉnh sửa nguyên liệu', width: 520,
        render(body, close) {
            let busy = false;
            body.innerHTML = `
            <form data-form novalidate>
                <div class="${FIELD}">
                    <label for="ig-name" class="${LABEL}">Tên nguyên liệu <span class="text-red-600">*</span></label>
                    <input id="ig-name" maxlength="100" autocomplete="off" value="${esc(titleCase(ingredient?.name))}" class="${INPUT_CLS}">
                </div>
                <div class="${FIELD} grid grid-cols-2 gap-3">
                    <div>
                        <label for="ig-type" class="${LABEL}">Loại</label>
                        <select id="ig-type" class="${INPUT_CLS}">
                            ${Object.entries(INGREDIENT_TYPES).map(([v, l]) => `<option value="${v}" ${v === type0 ? 'selected' : ''}>${esc(l)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="ig-unit" class="${LABEL}">Đơn vị <span class="text-red-600">*</span></label>
                        <input id="ig-unit" list="ig-units" maxlength="20" autocomplete="off" value="${esc(ingredient?.unit)}" placeholder="kg, lít…" class="${INPUT_CLS}">
                        <datalist id="ig-units">${UNITS.map(u => `<option value="${u}"></option>`).join('')}</datalist>
                    </div>
                </div>
                <div class="${FIELD} grid grid-cols-2 gap-3">
                    <div>
                        <label for="ig-min" class="${LABEL}">Giá trị cảnh báo <span class="text-red-600">*</span></label>
                        <input id="ig-min" inputmode="decimal" autocomplete="off" value="${isNew ? '' : esc(plain(ingredient.minStock))}" placeholder="0" class="${INPUT_CLS} text-right">
                        <p class="${HINT}">Báo “Sắp hết” khi tồn kho ≤ giá trị này.</p>
                    </div>
                    <div data-yield ${type0 === 'FRESH' ? '' : 'hidden'}>
                        <label for="ig-yield" class="${LABEL}">Tỷ lệ thành phẩm (%) <span class="text-red-600">*</span></label>
                        <input id="ig-yield" inputmode="decimal" autocomplete="off" value="${ingredient?.yieldRate ? esc(plain(Math.round(ingredient.yieldRate * 10000) / 100)) : '100'}" class="${INPUT_CLS} text-right">
                        <p class="${HINT}">Phần dùng được sau sơ chế (1–100).</p>
                    </div>
                </div>
                <div class="${FIELD}">
                    ${isNew ? `
                    <label for="ig-stock" class="${LABEL}">Tồn kho ban đầu</label>
                    <input id="ig-stock" inputmode="decimal" autocomplete="off" placeholder="0 (không bắt buộc)" class="${INPUT_CLS} text-right">
                    <p class="${HINT}">Nếu nhập, hệ thống tự tạo và duyệt một phiếu nhập kho “Tồn kho ban đầu”.</p>` : `
                    <p class="text-sm"><span class="font-semibold">Tồn kho hiện tại:</span> <b>${num(ingredient.stock)} ${esc(ingredient.unit)}</b></p>
                    <p class="${HINT}">Tồn kho chỉ thay đổi qua phiếu kho (nhập, xuất, hao hụt).</p>`}
                </div>
                <p data-error class="mb-1 min-h-5 text-sm font-medium text-red-600" role="alert"></p>
                <div class="${BTN_ROW}">
                    <p-button data-act="ok" label="${isNew ? 'Thêm nguyên liệu' : 'Lưu chỉnh sửa'}" icon="check" variant="solid"></p-button>
                    <p-button data-act="cancel" label="Huỷ"></p-button>
                </div>
            </form>`;

            const $ = sel => body.querySelector(sel);
            const err = $('[data-error]');
            const okBtn = $('[data-act="ok"]');
            const fail = (msg, sel) => { err.textContent = msg; $(sel)?.focus(); };

            $('#ig-type').addEventListener('change', e => { $('[data-yield]').hidden = e.target.value !== 'FRESH'; });

            const submit = async () => {
                if (busy) return;
                err.textContent = '';
                const name = $('#ig-name').value.trim();
                const unit = $('#ig-unit').value.trim();
                const type = $('#ig-type').value;
                const minStock = parseNum($('#ig-min').value);
                const pct = parseNum($('#ig-yield').value);
                const opening = isNew ? parseNum($('#ig-stock').value || '0') : 0;

                if (!name) return fail('Vui lòng nhập tên nguyên liệu', '#ig-name');
                if (!unit) return fail('Vui lòng nhập đơn vị', '#ig-unit');
                if (!Number.isFinite(minStock) || minStock < 0) return fail('Giá trị cảnh báo phải là số không âm', '#ig-min');
                if (type === 'FRESH' && !(pct > 0 && pct <= 100)) return fail('Tỷ lệ thành phẩm phải trong khoảng 1–100%', '#ig-yield');
                if (!Number.isFinite(opening) || opening < 0) return fail('Tồn kho ban đầu phải là số không âm', '#ig-stock');

                const data = { name, type, unit, minStock, yieldRate: Math.round(pct * 100) / 10000 };
                busy = true; okBtn.toggleAttribute('disabled', true);
                try {
                    if (isNew) {
                        const { stockError } = await storageService.createIngredient(data, opening);
                        if (stockError) toast(`Đã thêm nguyên liệu nhưng chưa nhập được tồn kho ban đầu: ${stockError}`);
                        else toast('Đã thêm nguyên liệu', 'success');
                    } else {
                        await storageService.updateIngredient(ingredient.id, data);
                        toast('Đã lưu chỉnh sửa', 'success');
                    }
                    close(true);
                } catch (e) {
                    err.textContent = e.message || 'Không lưu được nguyên liệu';
                    busy = false; okBtn.toggleAttribute('disabled', false);
                }
            };

            body.querySelector('[data-form]').addEventListener('submit', e => { e.preventDefault(); submit(); });
            bindActions(body, { ok: submit, cancel: () => close(false) });
            setTimeout(() => $('#ig-name').focus(), 0);
        },
    });
}

/* ───────────────────────── Tạo phiếu kho ───────────────────────── */

export function documentCreateDialog({ ingredients }) {
    const usable = ingredients.filter(i => i.active);

    return openDialog({
        title: 'Tạo phiếu kho', width: 660,
        render(body, close) {
            let busy = false;
            const st = { type: 'IMPORT', note: '', lines: [] };

            body.innerHTML = `
            <form data-form novalidate>
                <div class="${FIELD} grid gap-3 sm:grid-cols-[1fr_2fr]">
                    <div>
                        <label for="dc-type" class="${LABEL}">Loại phiếu</label>
                        <select id="dc-type" data-f="type" class="${INPUT_CLS}">
                            ${Object.entries(DOC_TYPES).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label for="dc-note" class="${LABEL}">Ghi chú</label>
                        <input id="dc-note" data-f="note" maxlength="200" autocomplete="off" placeholder="Không bắt buộc" class="${INPUT_CLS}">
                    </div>
                </div>
                <div class="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <span class="text-sm font-semibold">Nguyên liệu trong phiếu</span>
                    <select data-f="add" aria-label="Thêm nguyên liệu vào phiếu" class="${INPUT_CLS} max-w-64"></select>
                </div>
                <div data-lines class="max-h-72 overflow-y-auto rounded-xl border border-primary-200 bg-white"></div>
                <p data-warn class="${HINT}"></p>
                <p data-error class="mb-1 mt-2 min-h-5 text-sm font-medium text-red-600" role="alert"></p>
                <div class="${BTN_ROW}">
                    <p-button data-act="ok" label="Tạo phiếu" icon="check" variant="solid"></p-button>
                    <p-button data-act="cancel" label="Huỷ"></p-button>
                </div>
            </form>`;

            const $ = sel => body.querySelector(sel);
            const err = $('[data-error]');
            const okBtn = $('[data-act="ok"]');
            const linesBox = $('[data-lines]');
            const addSel = $('[data-f="add"]');

            const drawAdd = () => {
                const left = usable.filter(i => !st.lines.some(l => l.ing.id === i.id));
                addSel.innerHTML = `<option value="">${left.length ? '+ Chọn nguyên liệu để thêm…' : 'Đã thêm hết nguyên liệu'}</option>`
                    + left.map(i => `<option value="${esc(i.id)}">${esc(titleCase(i.name))} (${esc(i.code)})</option>`).join('');
                addSel.disabled = !left.length;
            };

            const drawLines = () => {
                $('[data-warn]').textContent = st.type === 'IMPORT' ? '' : 'Phiếu xuất/hao hụt sẽ trừ tồn kho khi được duyệt; số lượng không được vượt tồn kho.';
                linesBox.innerHTML = st.lines.length
                    ? st.lines.map(l => `
                    <div class="flex items-center gap-3 border-b border-primary-100 px-3 py-2 last:border-0">
                        <div class="min-w-0 flex-1">
                            <p class="line-clamp-1 text-sm font-bold">${esc(titleCase(l.ing.name))}</p>
                            <p class="text-xs text-secondary-700">${esc(l.ing.code)} · Tồn: ${num(l.ing.stock)} ${esc(l.ing.unit)}</p>
                        </div>
                        <input data-qty="${esc(l.ing.id)}" inputmode="decimal" autocomplete="off" value="${esc(l.quantity)}" placeholder="0" aria-label="Số lượng ${esc(titleCase(l.ing.name))}" style="width:calc(var(--spacing) * 24)" class="${INPUT_CLS} text-right">
                        <span class="w-9 text-sm">${esc(l.ing.unit)}</span>
                        <button type="button" data-act="rm-line" data-id="${esc(l.ing.id)}" class="${ICON_BTN}" title="Bỏ khỏi phiếu" aria-label="Bỏ ${esc(titleCase(l.ing.name))} khỏi phiếu">✕</button>
                    </div>`).join('')
                    : '<p class="py-8 text-center text-sm text-secondary-700">Chưa có nguyên liệu nào. Chọn ở ô phía trên để thêm.</p>';
            };

            body.addEventListener('input', e => {
                const d = e.target.dataset;
                if (d?.f === 'note') st.note = e.target.value;
                else if (d?.qty != null) {
                    const l = st.lines.find(x => String(x.ing.id) === d.qty);
                    if (l) l.quantity = e.target.value;
                }
            });
            body.addEventListener('change', e => {
                const f = e.target.dataset?.f;
                if (f === 'type') { st.type = e.target.value; drawLines(); }
                else if (f === 'add' && e.target.value) {
                    const ing = usable.find(i => String(i.id) === e.target.value);
                    if (ing) st.lines.push({ ing, quantity: '' });
                    drawAdd(); drawLines();
                    linesBox.querySelector(`[data-qty="${ing?.id}"]`)?.focus();
                    linesBox.scrollTop = linesBox.scrollHeight;
                }
            });

            const submit = async () => {
                if (busy) return;
                err.textContent = '';
                if (!st.lines.length) { err.textContent = 'Phiếu cần ít nhất 1 nguyên liệu'; return; }
                const items = [];
                for (const l of st.lines) {
                    const q = parseNum(l.quantity);
                    if (!(q > 0)) { err.textContent = `Nhập số lượng lớn hơn 0 cho ${titleCase(l.ing.name)}`; linesBox.querySelector(`[data-qty="${l.ing.id}"]`)?.focus(); return; }
                    if (st.type !== 'IMPORT' && q > l.ing.stock) { err.textContent = `${titleCase(l.ing.name)}: số lượng ${num(q)} vượt tồn kho (${num(l.ing.stock)} ${l.ing.unit})`; return; }
                    items.push({ ingredientId: l.ing.id, code: l.ing.code, name: l.ing.name, unit: l.ing.unit, quantity: q });
                }
                busy = true; okBtn.toggleAttribute('disabled', true);
                try {
                    await storageService.createDocument({ type: st.type, note: st.note.trim(), items });
                    toast('Đã tạo phiếu, đang chờ duyệt', 'success');
                    close(true);
                } catch (e) {
                    err.textContent = e.message || 'Không tạo được phiếu';
                    busy = false; okBtn.toggleAttribute('disabled', false);
                }
            };

            body.querySelector('[data-form]').addEventListener('submit', e => { e.preventDefault(); submit(); });
            bindActions(body, {
                'rm-line': el => { st.lines = st.lines.filter(l => String(l.ing.id) !== el.dataset.id); drawAdd(); drawLines(); },
                ok: submit,
                cancel: () => close(false),
            });
            drawAdd(); drawLines();
        },
    });
}

/* ───────────────────────── Chi tiết / duyệt phiếu ───────────────────────── */

export function documentDetailDialog({ doc, ingredients = [] }) {
    const items = storageService.docItems(doc.id);
    const byId = new Map(ingredients.map(i => [String(i.id), i]));
    const pending = doc.status === 'PENDING';
    const outgoing = doc.type !== 'IMPORT';
    const short = pending && outgoing
        ? items.filter(it => (byId.get(String(it.ingredientId))?.stock ?? Infinity) < it.quantity).map(it => it.ingredientId)
        : [];

    const steps = [
        { title: 'Tạo phiếu', who: doc.createdBy, at: doc.createdAt },
        pending
            ? { title: 'Chờ duyệt', who: '', at: '', current: true }
            : { title: doc.status === 'CONFIRMED' ? 'Đã duyệt' : 'Đã từ chối', who: doc.reviewedBy, at: doc.reviewedAt, current: true, bad: doc.status === 'CANCELLED' },
    ];

    return openDialog({
        title: 'Chi tiết phiếu kho', width: 960,
        render(body, close) {
            let busy = false;
            body.innerHTML = `
            <div class="grid gap-4 md:grid-cols-[1fr_250px]">
                <section class="rounded-2xl bg-white p-5">
                    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                        <h3 class="text-lg font-bold">${esc(doc.code)} · ${esc(DOC_TYPES[doc.type] ?? doc.type)}</h3>
                        <span class="text-sm font-bold ${DOC_STATUS_CLS[doc.status] ?? ''}">${esc(DOC_STATUS[doc.status] ?? doc.status)}</span>
                    </div>
                    ${doc.note ? `<p class="mb-3 text-sm"><span class="font-semibold">Ghi chú:</span> ${esc(doc.note)}</p>` : ''}
                    ${items.length ? `
                    <div class="overflow-x-auto rounded-xl border border-primary-200">
                        <table class="w-full min-w-[28rem] text-sm">
                            <thead><tr class="bg-primary-50 text-left text-xs uppercase text-primary-700">
                                <th class="px-3 py-2.5 font-bold">Mã NL</th><th class="px-3 py-2.5 font-bold">Tên nguyên liệu</th>
                                <th class="px-3 py-2.5 text-right font-bold">Số lượng</th><th class="px-3 py-2.5 font-bold">Đơn vị</th>
                            </tr></thead>
                            <tbody>${items.map(it => `
                                <tr class="border-t border-primary-100 ${short.includes(it.ingredientId) ? 'bg-red-50' : ''}">
                                    <td class="px-3 py-2.5 font-bold text-primary-700">${esc(it.code)}</td>
                                    <td class="px-3 py-2.5 font-bold">${esc(titleCase(it.name))}</td>
                                    <td class="px-3 py-2.5 text-right font-bold">${num(it.quantity)}</td>
                                    <td class="px-3 py-2.5">${esc(it.unit)}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>` : `
                    <p class="rounded-xl bg-neutral-100 p-3 text-sm text-secondary-700">Chưa có danh sách nguyên liệu của phiếu này trên máy này. Backend chưa trả chi tiết nguyên liệu theo phiếu; danh sách chỉ xem được với phiếu tạo ngay trên trình duyệt này.</p>`}
                    ${short.length ? `<p class="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">Tồn kho hiện không đủ cho: ${esc(short.map(id => titleCase(items.find(i => i.ingredientId === id)?.name)).join(', '))}. Duyệt phiếu sẽ không thành công.</p>` : ''}
                    ${doc.status === 'CANCELLED' ? `
                    <h4 class="mt-5 text-sm font-bold text-red-500">Lý do từ chối</h4>
                    <p class="mt-1 text-sm">${esc(doc.rejectReason || 'Không có lý do')}</p>` : ''}
                    ${pending ? `
                    <label for="dd-reason" class="mb-1.5 mt-5 block text-sm font-semibold">Phản hồi của người duyệt phiếu</label>
                    <textarea id="dd-reason" data-f="reason" rows="3" class="${INPUT_CLS} resize-none" placeholder="Nhập lý do từ chối (bắt buộc khi từ chối)…"></textarea>
                    <p data-error class="mt-1 min-h-5 text-sm font-medium text-red-600" role="alert"></p>
                    <div class="mt-2 flex flex-wrap justify-end gap-3">
                        <p-button data-act="reject" label="Từ chối duyệt" icon="close" variant="danger"></p-button>
                        <p-button data-act="approve" label="Phê duyệt phiếu" icon="check" variant="solid"></p-button>
                    </div>` : ''}
                </section>
                <aside>
                    <h3 class="mb-3 text-base font-bold">Lịch sử trạng thái phiếu</h3>
                    <ol class="space-y-4">
                        ${steps.map((s, i) => `
                        <li class="flex gap-3">
                            <span class="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.current ? 'bg-primary-700 text-white' : 'bg-primary-100 text-primary-800'}">${i + 1}</span>
                            <div class="min-w-0">
                                <p class="font-bold ${s.bad ? 'text-red-500' : ''}">${esc(s.title)}</p>
                                ${s.who ? `<p class="text-xs text-secondary-700">${esc(s.who)}</p>` : ''}
                                ${s.at ? `<p class="text-xs text-secondary-700">${esc(fmtDateTime(s.at))}</p>` : ''}
                            </div>
                        </li>`).join('')}
                    </ol>
                </aside>
            </div>
            <div class="mt-4 flex justify-end"><p-button data-act="cancel" label="Đóng"></p-button></div>`;

            const err = body.querySelector('[data-error]');
            const setBusy = v => { busy = v; body.querySelectorAll('[data-act="approve"],[data-act="reject"]').forEach(b => b.toggleAttribute('disabled', v)); };
            const run = async (fn, okMsg) => {
                if (busy) return;
                if (err) err.textContent = '';
                setBusy(true);
                try { await fn(); toast(okMsg, 'success'); close(true); }
                catch (e) {
                    const hint = outgoing ? ' — kiểm tra tồn kho có đủ để trừ không.' : '';
                    if (err) err.textContent = `${e.message || 'Không thực hiện được'}${hint}`; else toast(e.message || 'Không thực hiện được');
                    setBusy(false);
                }
            };

            bindActions(body, {
                approve: () => run(() => storageService.approveDocument(doc.id), 'Đã duyệt phiếu'),
                reject: () => {
                    const reason = body.querySelector('[data-f="reason"]')?.value.trim();
                    if (!reason) { err.textContent = 'Vui lòng nhập lý do từ chối'; body.querySelector('[data-f="reason"]')?.focus(); return; }
                    run(() => storageService.rejectDocument(doc.id, reason), 'Đã từ chối phiếu');
                },
                cancel: () => close(false),
            });
        },
    });
}

/* ───────────────────────── Công thức món ───────────────────────── */

export function recipeDialog({ product, ingredients }) {
    return openDialog({
        title: `Công thức — ${titleCase(product.name)}`, width: 640,
        render(body, close) {
            let lines = [];   // dòng đã có trên server: { id, name, unit, quantity, draft, removed }
            let added = [];   // dòng mới, chưa lưu:     { ingredientId, name, unit, quantity }
            let busy = false;
            let loadError = '';
            let dirty = false;

            body.innerHTML = `
                <p class="mb-3 text-xs text-secondary-700">Định lượng nguyên liệu cho 1 phần món. Mọi thay đổi (thêm, sửa, xoá) chỉ được lưu khi bấm “Lưu thay đổi”. Công thức hiện chỉ dùng để định nghĩa, bán hàng chưa tự trừ kho.</p>
                <div data-list class="max-h-64 overflow-y-auto rounded-xl border border-primary-200 bg-white"></div>
                <div class="mt-3 grid grid-cols-[1fr_6rem_auto] items-end gap-2">
                    <div><label class="${LABEL}" for="rc-ing">Thêm nguyên liệu</label><select id="rc-ing" class="${INPUT_CLS}"></select></div>
                    <div><label class="${LABEL}" for="rc-qty">Số lượng</label><input id="rc-qty" inputmode="decimal" autocomplete="off" placeholder="0" class="${INPUT_CLS} text-right"></div>
                    <p-button data-act="r-add" label="Thêm" icon="add"></p-button>
                </div>
                <p data-error class="mt-2 min-h-5 text-sm font-medium text-red-600" role="alert"></p>
                <div class="${BTN_ROW}">
                    <p-button data-act="r-save" label="Lưu thay đổi" icon="check" variant="solid" disabled></p-button>
                    <p-button data-act="done" label="Đóng"></p-button>
                </div>`;

            const $ = sel => body.querySelector(sel);
            const err = $('[data-error]');
            const list = $('[data-list]');
            const saveBtn = $('[data-act="r-save"]');

            const changed = () => lines.filter(l => !l.removed && parseNum(l.draft) !== l.quantity);
            const hasChanges = () => changed().length > 0 || added.length > 0 || lines.some(l => l.removed);
            const syncSave = () => saveBtn.toggleAttribute('disabled', busy || !hasChanges());

            const ROW = 'flex items-center gap-3 border-b border-primary-100 px-3 py-2 last:border-0';

            const draw = () => {
                const existing = lines.map(l => l.removed ? `
                    <div class="${ROW} opacity-60">
                        <p class="line-clamp-1 min-w-0 flex-1 text-sm font-bold line-through">${esc(titleCase(l.name))}</p>
                        <span class="text-xs font-semibold text-red-600">Sẽ xoá</span>
                        <button type="button" data-act="r-undo" data-id="${esc(l.id)}" class="${ICON_BTN} text-sm font-bold" title="Hoàn tác" aria-label="Hoàn tác xoá ${esc(titleCase(l.name))}">↩</button>
                    </div>` : `
                    <div class="${ROW}">
                        <p class="line-clamp-1 min-w-0 flex-1 text-sm font-bold">${esc(titleCase(l.name))}</p>
                        <input data-rq="${esc(l.id)}" inputmode="decimal" autocomplete="off" value="${esc(l.draft)}" aria-label="Số lượng ${esc(titleCase(l.name))}" style="width:calc(var(--spacing) * 24)" class="${INPUT_CLS} text-right">
                        <span class="w-9 text-sm">${esc(l.unit)}</span>
                        <button type="button" data-act="r-del" data-id="${esc(l.id)}" class="${ICON_BTN}" title="Xoá khỏi công thức" aria-label="Xoá ${esc(titleCase(l.name))} khỏi công thức">✕</button>
                    </div>`).join('');
                const fresh = added.map((a, i) => `
                    <div class="${ROW} bg-primary-50">
                        <p class="line-clamp-1 min-w-0 flex-1 text-sm font-bold">${esc(titleCase(a.name))} <span class="ml-1 rounded-full bg-primary-700 px-1.5 py-0.5 text-[10px] font-bold text-white">Mới</span></p>
                        <span class="w-24 text-right text-sm font-bold">${num(a.quantity)}</span>
                        <span class="w-9 text-sm">${esc(a.unit)}</span>
                        <button type="button" data-act="r-rm-new" data-i="${i}" class="${ICON_BTN}" title="Bỏ nguyên liệu mới" aria-label="Bỏ ${esc(titleCase(a.name))}">✕</button>
                    </div>`).join('');

                list.innerHTML = loadError
                    ? `<p class="py-8 text-center text-sm text-red-600">${esc(loadError)}</p>`
                    : (existing + fresh) || '<p class="py-8 text-center text-sm text-secondary-700">Món này chưa có nguyên liệu nào.</p>';

                const used = new Set([...lines.filter(l => !l.removed).map(l => l.name), ...added.map(a => a.name)].map(n => n.trim().toLowerCase()));
                const left = ingredients.filter(i => i.active && !used.has(i.name.trim().toLowerCase()));
                $('#rc-ing').innerHTML = left.length
                    ? left.map(i => `<option value="${esc(i.id)}">${esc(titleCase(i.name))} (${esc(i.unit)})</option>`).join('')
                    : '<option value="">Không còn nguyên liệu để thêm</option>';
                syncSave();
            };

            const load = async () => {
                list.innerHTML = '<p class="py-8 text-center text-sm text-secondary-700">Đang tải…</p>';
                try {
                    lines = (await storageService.listRecipe(product.id)).map(l => ({ ...l, draft: String(l.quantity), removed: false }));
                    loadError = '';
                } catch (e) {
                    lines = [];
                    loadError = e.message || 'Không tải được công thức';
                }
                draw();
            };

            body.addEventListener('input', e => {
                const id = e.target.dataset?.rq;
                if (id == null) return;
                const l = lines.find(x => String(x.id) === id);
                if (l) { l.draft = e.target.value; syncSave(); }
            });

            const save = async () => {
                if (busy) return;
                err.textContent = '';
                const edits = changed();
                const bad = edits.find(l => !(parseNum(l.draft) > 0));
                if (bad) { err.textContent = `Số lượng của ${titleCase(bad.name)} phải lớn hơn 0`; return; }
                const removedIds = lines.filter(l => l.removed).map(l => l.id);

                busy = true; syncSave();
                try {
                    // xoá trước để giải phóng tên, rồi sửa, rồi thêm mới
                    if (removedIds.length) await storageService.deleteRecipeLines(product.id, removedIds);
                    if (edits.length) await storageService.updateRecipeLines(product.id, edits.map(l => ({ id: l.id, quantity: parseNum(l.draft) })));
                    if (added.length) await storageService.addRecipeLines(product.id, added.map(a => ({ ingredientId: a.ingredientId, quantity: a.quantity })));
                    dirty = true;
                    added = [];
                    toast('Đã lưu công thức', 'success');
                } catch (e) {
                    dirty = true; // có thể đã lưu một phần -> tải lại để thấy trạng thái thật
                    err.textContent = e.message || 'Không lưu được công thức';
                }
                await load();
                busy = false; syncSave();
            };

            bindActions(body, {
                'r-add': () => {
                    err.textContent = '';
                    const id = $('#rc-ing').value;
                    const ing = ingredients.find(i => String(i.id) === id);
                    const quantity = parseNum($('#rc-qty').value);
                    if (!ing) { err.textContent = 'Hãy chọn nguyên liệu'; return; }
                    if (!(quantity > 0)) { err.textContent = 'Số lượng phải lớn hơn 0'; $('#rc-qty').focus(); return; }
                    added.push({ ingredientId: ing.id, name: ing.name, unit: ing.unit, quantity });
                    $('#rc-qty').value = '';
                    draw();
                    list.scrollTop = list.scrollHeight;
                },
                'r-rm-new': el => { added.splice(Number(el.dataset.i), 1); draw(); },
                'r-del': el => { const l = lines.find(x => String(x.id) === el.dataset.id); if (l) { l.removed = true; draw(); } },
                'r-undo': el => { const l = lines.find(x => String(x.id) === el.dataset.id); if (l) { l.removed = false; draw(); } },
                'r-save': save,
                done: async () => {
                    if (hasChanges() && !await confirmDialog({
                        title: 'Bỏ thay đổi chưa lưu', message: 'Công thức có thay đổi chưa lưu. Đóng và bỏ các thay đổi này?',
                        confirmLabel: 'Bỏ thay đổi', confirmIcon: 'close', variant: 'danger',
                    })) return;
                    close(dirty);
                },
            });

            load();
        },
    });
}