// Bước 1 — Vai trò & phân quyền (role theo shop). Ma trận Xem/Thêm/Sửa/Xoá + cột "Khác".

import { hr, PERM_MATRIX, PERM_LABEL, cap } from '../../services/HrService.js';
import { confirmDialog } from '../../utils/dialog.js';
import { HrPanel, esc, INPUT_CLS, CARD, TH, notice, toast } from './ui.js';
import { ICONS } from '../../icon.js';

const COLS = [['view', 'Xem'], ['create', 'Thêm mới'], ['update', 'Sửa'], ['delete', 'Xoá']];
const OWNER = 'owner';

class RolePanel extends HrPanel {
    state = { roles: [], inactive: [], permIdByName: {}, selected: null, draft: null };

    build() {
        this.innerHTML = `
        <div class="grid items-start gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
            <section class="${CARD} min-w-0" aria-label="Danh sách vai trò">
                <h2 class="text-base font-bold">Nhóm vai trò của cửa hàng</h2>
                <div data-list class="mt-3 flex flex-wrap gap-1.5 xl:grid"></div>
                <div class="mt-4 border-t border-primary-50 pt-4">
                    <p-button data-act="new" label="Tạo nhóm vai trò mới" icon="add" variant="solid"></p-button>
                </div>
            </section>
            <section data-detail class="${CARD} min-w-0" aria-live="polite"></section>
        </div>`;
    }

    async load() {
        // Vai trò đã xoá chỉ để xem: lỗi khi tải chúng không được làm hỏng danh sách vai trò đang dùng.
        const [roles, inactive, perms] = await Promise.all([hr.listRoles(), hr.listInactiveRoles().catch(() => []), hr.listPermissions()]);
        const s = this.state;
        s.roles = roles;
        s.inactive = inactive;
        s.permIdByName = Object.fromEntries(perms.map(p => [p.name, p.id]));
        s.permNameById = Object.fromEntries(perms.map(p => [p.id, p.name]));
        if (s.selected !== 'new' && s.selected !== OWNER && !roles.some(r => r.id === s.selected) && !inactive.some(r => r.id === s.selected)) { s.selected = roles[0]?.id ?? OWNER; s.draft = null; }
        s.selected ??= roles[0]?.id ?? OWNER;
    }

    get role() { return this.state.roles.find(r => r.id === this.state.selected) ?? this.state.inactive.find(r => r.id === this.state.selected); }
    get isGone() { return this.role?.status === 'INACTIVE'; }
    /** Tập permission đang hiển thị: bản nháp khi đang sửa, ngược lại là của vai trò. */
    get names() {
        const s = this.state;
        if (s.selected === OWNER) return new Set(Object.keys(s.permIdByName));
        if (s.draft) return s.draft.names;
        return new Set((this.role?.permissionIds ?? []).map(id => s.permNameById[id]));
    }

    draw() {
        const s = this.state;
        this.querySelector('[data-list]').innerHTML = [
            this.item(OWNER, 'Chủ cửa hàng (Owner)', true),
            ...s.roles.map(r => this.item(r.id, cap(r.name))),
            ...(s.selected === 'new' ? [this.item('new', s.draft?.name?.trim() ? cap(s.draft.name) : 'Vai trò mới…')] : []),
            // Vai trò đã xoá luôn nằm cuối danh sách, mờ đi và chỉ xem được.
            ...(s.inactive.length ? ['<p class="mt-2 px-3.5 text-xs font-bold uppercase tracking-wide text-secondary-700 xl:w-full">Ngưng hoạt động</p>'] : []),
            ...s.inactive.map(r => this.item(r.id, cap(r.name), false, true)),
        ].join('');
        this.drawDetail();
    }

    item(id, label, locked = false, gone = false) {
        const on = this.state.selected === id;
        return `<button type="button" data-act="select" data-id="${esc(id)}" aria-pressed="${on}"
            class="flex cursor-pointer items-center justify-between gap-3 rounded-xl xl:w-full border px-3.5 py-2.5 text-left text-sm font-semibold transition-all hover:scale-[0.99]
            ${on ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-transparent text-secondary-800 hover:bg-neutral-50'} ${gone ? 'opacity-60' : ''}">
            <span class="${gone ? 'line-through' : ''}">${esc(label)}</span>${locked ? `<span class="text-primary-500">${ICONS.lock}</span>` : ''}</button>`;
    }

    drawDetail() {
        const s = this.state;
        const box = this.querySelector('[data-detail]');
        const editing = Boolean(s.draft);
        const gone = this.isGone;
        const owner = s.selected === OWNER;
        const names = this.names;
        const title = owner ? 'Chủ cửa hàng (Owner)' : (s.draft ? s.draft.name : cap(this.role?.name ?? ''));

        const cell = (row, col) => {
            const list = row[col];
            if (!list.length) return '<span class="text-neutral-300">—</span>';
            const on = list.every(n => names.has(n));
            return `<input type="checkbox" data-cell="${row.key}|${col}" ${on ? 'checked' : ''} ${editing ? '' : 'disabled'}
                aria-label="${esc(row.label)} — ${col}" class="size-5 cursor-pointer accent-primary disabled:cursor-default">`;
        };
        const other = row => row.other.length ? `<div class="flex flex-col gap-y-1">${row.other.map(n => `
            <label class="inline-flex items-center gap-1.5 text-xs font-semibold ${editing ? 'cursor-pointer' : ''}">
                <input type="checkbox" data-perm="${n}" ${names.has(n) ? 'checked' : ''} ${editing ? '' : 'disabled'} class="size-4 accent-primary">
                ${esc(PERM_LABEL[n] ?? n)}</label>`).join('')}</div>` : '<span class="text-neutral-300">—</span>';

        box.innerHTML = `
            <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 class="text-lg font-bold">Quyền hạn</h2>
                    <p class="text-sm text-secondary-700">Chức năng quản trị và điều phối nghiệp vụ theo từng vai trò trong cửa hàng</p>
                </div>
                <div class="btn-row w-full md:w-auto">${owner || gone ? '' : editing ? `
                    <p-button data-act="save" label="Lưu thay đổi" icon="check" variant="solid"></p-button>
                    <p-button data-act="cancel" label="Huỷ"></p-button>` : `
                    <p-button data-act="edit" label="Chỉnh sửa" icon="edit"></p-button>
                    <p-button data-act="delete" label="Tạm ngưng" icon="pause" variant="danger"></p-button>`}
                </div>
            </div>
            <div class="mt-4 flex flex-wrap items-center gap-3">
                <label for="role-name" class="text-sm font-bold">Tên vai trò</label>
                <input id="role-name" data-name class="${INPUT_CLS} w-72!" maxlength="50" placeholder="VD: Thu ngân"
                    value="${esc(editing ? s.draft.name : title)}" ${editing ? '' : 'disabled'}>
            </div>
            ${owner ? `<div class="mt-4">${notice('Chủ cửa hàng luôn có <b>toàn quyền</b> và không thể chỉnh sửa hay tạm ngừng.', 'green')}</div>` : ''}
            ${gone ? `<div class="mt-4">${notice('Vai trò này đã tạm ngừng hoạt động nên chỉ xem được, không chỉnh sửa hay gán cho nhân viên. Backend chưa có chức năng bật lại vai trò.')}</div>` : ''}
            <ul class="mt-4 grid gap-2 md:hidden">${PERM_MATRIX.map(row => `
                <li class="rounded-xl border border-primary-50 p-3">
                    <p class="font-bold">${esc(row.label)}</p>
                    <div class="mt-1 grid divide-y divide-primary-50">
                        ${COLS.filter(([c]) => row[c].length).map(([c, l]) => `
                        <label class="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold ${editing ? 'cursor-pointer' : ''}"><span>${l}</span>${cell(row, c)}</label>`).join('')}
                        ${row.other.map(n => `
                        <label class="flex min-h-11 items-center justify-between gap-3 text-sm font-semibold ${editing ? 'cursor-pointer' : ''}"><span>${esc(PERM_LABEL[n] ?? n)}</span>
                            <input type="checkbox" data-perm="${n}" ${names.has(n) ? 'checked' : ''} ${editing ? '' : 'disabled'} class="size-5 accent-primary"></label>`).join('')}
                    </div>
                </li>`).join('')}</ul>
            <div class="mt-4 hidden overflow-x-auto rounded-xl border border-primary-50 md:block">
                <table class="w-full min-w-170 text-sm">
                    <thead class="bg-secondary-50"><tr>
                        <th class="${TH}">Chức năng hệ thống</th>
                        ${COLS.map(([, l]) => `<th class="${TH} text-center">${l}</th>`).join('')}
                        <th class="${TH}">Khác</th>
                    </tr></thead>
                    <tbody>${PERM_MATRIX.map(row => `
                        <tr class="border-t border-primary-50">
                            <th scope="row" class="px-3 py-3 text-left font-bold">${esc(row.label)}</th>
                            ${COLS.map(([c]) => `<td class="px-3 py-3 text-center">${cell(row, c)}</td>`).join('')}
                            <td class="px-3 py-3">${other(row)}</td>
                        </tr>`).join('')}</tbody>
                </table>
            </div>
            <p class="mt-3 text-xs text-secondary-700">Quyền chấm công cho nhân viên chưa có trong danh sách quyền của backend; hiện chỉ chủ cửa hàng thao tác được.</p>`;
    }

    onInput(e) {
        if (e.target.matches('[data-name]') && this.state.draft) {
            this.state.draft.name = e.target.value;
            const sel = this.querySelector('[data-list] [aria-pressed="true"] span');
            if (sel && this.state.selected === 'new') sel.textContent = e.target.value.trim() ? cap(e.target.value) : 'Vai trò mới…';
        }
    }

    onChange(e) {
        const d = this.state.draft;
        if (!d) return;
        const t = e.target;
        if (t.dataset.cell) {
            const [key, col] = t.dataset.cell.split('|');
            PERM_MATRIX.find(r => r.key === key)[col].forEach(n => t.checked ? d.names.add(n) : d.names.delete(n));
            this.querySelectorAll(`[data-cell="${t.dataset.cell}"]`).forEach(o => { o.checked = t.checked; });
        } else if (t.dataset.perm) {
            t.checked ? d.names.add(t.dataset.perm) : d.names.delete(t.dataset.perm);
            this.querySelectorAll(`[data-perm="${t.dataset.perm}"]`).forEach(o => { o.checked = t.checked; });
        }
    }

    startEdit(role) {
        const s = this.state;
        s.draft = {
            id: role?.id, name: role ? cap(role.name) : '',
            names: new Set((role?.permissionIds ?? []).map(id => s.permNameById[id])),
        };
    }

    actions() {
        return {
            select: async el => {
                const s = this.state;
                if (s.draft && !await confirmDialog({ title: 'Thay đổi chưa lưu', message: 'Bỏ các thay đổi chưa lưu?', confirmLabel: 'Bỏ thay đổi', confirmIcon: 'delete', variant: 'danger' })) return;
                s.draft = null;
                s.selected = el.dataset.id === OWNER ? OWNER : Number(el.dataset.id);
                this.draw();
            },
            new: () => { this.state.selected = 'new'; this.startEdit(null); this.draw(); this.querySelector('[data-name]')?.focus(); },
            edit: () => { if (this.isGone) return; this.startEdit(this.role); this.drawDetail(); },
            cancel: () => {
                const s = this.state;
                s.draft = null;
                if (s.selected === 'new') s.selected = s.roles[0]?.id ?? OWNER;
                this.draw();
            },
            save: async () => {
                const s = this.state, d = s.draft;
                if (!d.name.trim()) return toast('Tên vai trò không được để trống');
                const ids = [...d.names].map(n => s.permIdByName[n]).filter(Boolean);
                // Cập nhật selection/draft ngay trong fn để lần reload kế tiếp vẽ đúng (không bị lẫn mục "Vai trò mới…").
                await this.run(async () => {
                    const saved = await hr.saveRole({ id: d.id, name: d.name, permissionIds: ids });
                    s.draft = null;
                    s.selected = saved.id;
                }, 'Đã lưu vai trò');
            },
            delete: async () => {
                const r = this.role;
                if (!r || this.isGone) return;
                const ok = await confirmDialog({ title: 'Tạm ngừng vai trò', message: `Xác nhận tạm ngừng vai trò ${cap(r.name)}? Backend chưa có chức năng bật lại vai trò nên sau khi tạm ngừng chỉ xem được.`, confirmLabel: 'Tạm ngừng', confirmIcon: 'pause', variant: 'danger' });
                if (ok) this.run(async () => { await hr.deleteRole(r.id); this.state.selected = null; }, 'Đã tạm ngừng vai trò');
            },
        };
    }
}

customElements.define('hr-roles', RolePanel);