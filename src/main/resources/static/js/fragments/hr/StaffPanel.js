// Bước 2 — Nhân viên: đăng ký nhân viên, cấp tài khoản + mật khẩu, gán vai trò, lương.

import { hr, cap, ymd } from '../../services/HrService.js';
import { openDialog, confirmDialog } from '../../utils/dialog.js';
import { HrPanel, esc, INPUT_CLS, CARD, TH, chip, field, notice, emptyState, SELECT_CLS, bindActions, toast, fmtMoney, copyText } from './ui.js';
import { ICONS } from '../../icon.js';


const genPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const a = crypto.getRandomValues(new Uint32Array(10));
    return [...a].map(n => chars[n % chars.length]).join('');
};

class StaffPanel extends HrPanel {
    state = { staff: [], roles: [], staffError: null, q: '', status: 'ACTIVE', role: '' };

    build() {
        this.innerHTML = `
        <div class="flex flex-col gap-4">
            <div data-banner></div>
            <div class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
                <div class="flex flex-wrap items-center gap-2.5">
                    <label class="relative w-full md:w-auto">
                        <span class="sr-only">Tìm nhân viên</span>
                        <span class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-primary-300">${ICONS.search}</span>
                        <input data-q type="search" placeholder="Tìm tên, email, số điện thoại…" class="${INPUT_CLS} !w-full md:!w-72 !pl-10 text-sm">
                    </label>
                    <select data-status class="${SELECT_CLS}" aria-label="Lọc theo trạng thái">
                        <option value="">Tất cả</option><option value="ACTIVE" selected>Đang làm</option><option value="TERMINATED">Đã nghỉ</option>
                    </select>
                    <select data-role class="${SELECT_CLS}" aria-label="Lọc theo vai trò"></select>
                </div>
                <p-button data-act="add" label="Thêm nhân viên mới" icon="add" variant="solid" class="block md:inline-block"></p-button>
            </div>
            <section class="${CARD} !p-0 overflow-hidden"><div data-table class="overflow-x-auto"></div></section>
        </div>`;
    }

    async load() {
        // Tải riêng: lỗi khi xem danh sách nhân viên (vd 403 thiếu PERM_EMPLOYMENT_VIEW) không được làm mất danh sách vai trò,
        // nếu không nút "Thêm nhân viên" bị khoá và banner báo sai là chưa có vai trò.
        const roles = await hr.listRoles();
        let staff = [], staffError = null;
        try { staff = await hr.listStaff(); } catch (err) { staffError = err.message || 'Không tải được danh sách nhân viên'; toast(staffError); }
        Object.assign(this.state, { staff, roles, staffError });
    }

    draw() {
        const s = this.state;
        const sel = this.querySelector('[data-role]');
        sel.innerHTML = `<option value="">Mọi vai trò</option>${s.roles.map(r => `<option value="${r.id}" ${String(r.id) === s.role ? 'selected' : ''}>${esc(cap(r.name))}</option>`).join('')}`;

        this.querySelector('[data-banner]').innerHTML = [
            s.staffError ? notice(`Không tải được danh sách nhân viên: ${esc(s.staffError)}. Bạn vẫn có thể thêm nhân viên mới nếu có quyền tạo; nếu lỗi là thiếu quyền, hãy kiểm tra quyền <code>PERM_EMPLOYMENT_VIEW</code> của vai trò Owner ở backend rồi đăng nhập lại.`) : '',
            !s.roles.length ? notice('Chưa có vai trò nào. Hãy <a href="#roles" class="font-bold underline">tạo vai trò ở bước 1</a> trước khi thêm nhân viên.') : '',
        ].filter(Boolean).join('<div class="h-3"></div>');
        this.querySelector('[data-act="add"]').toggleAttribute('disabled', !s.roles.length);

        const q = s.q.trim().toLowerCase();
        const list = s.staff.slice().sort((a, b) => a.name.localeCompare(b.name, 'vi')).filter(x =>
            (!s.status || x.status === s.status) &&
            (!s.role || x.roleIds.includes(Number(s.role))) &&
            (!q || [x.name, x.email, x.phoneNumber].some(v => String(v ?? '').toLowerCase().includes(q))));

        this.querySelector('[data-table]').innerHTML = list.length ? `
            <ul class="divide-y divide-primary-50 md:hidden">${list.map(x => this.card(x)).join('')}</ul>
            <table class="hidden w-full min-w-190 text-sm md:table">
                <thead><tr class="border-b border-primary-100">
                    <th class="${TH}">Nhân viên</th><th class="${TH}">Vai trò</th><th class="${TH}">Email</th>
                    <th class="${TH}">Số điện thoại</th><th class="${TH} text-right">Lương cơ bản</th><th class="${TH} text-center">Trạng thái</th><th class="${TH}"><span class="sr-only">Thao tác</span></th>
                </tr></thead>
                <tbody>${list.map(x => this.row(x)).join('')}</tbody>
            </table>` : emptyState(
            this.loading ? 'Đang tải…' : s.staff.length ? 'Không có nhân viên phù hợp' : 'Chưa có nhân viên nào',
            s.staff.length ? 'Thử đổi bộ lọc hoặc từ khoá tìm kiếm.' : 'Nhấn “Thêm nhân viên mới” để đăng ký nhân viên và cấp tài khoản đăng nhập.');
    }

    card(x) {
        const off = x.status !== 'ACTIVE';
        return `<li class="flex items-center justify-between gap-3 p-4 ${off ? 'text-secondary-700' : ''}">
            <div class="min-w-0"><p class="truncate font-bold">${esc(x.name)}</p>
                <div class="mt-1 flex flex-wrap gap-1">${(x.roleNames ?? []).map(n => chip(cap(n), off ? 'gray' : 'green')).join('') || '<span class="text-xs">Chưa có vai trò</span>'}</div></div>
            <button type="button" data-act="view" data-id="${x.id}" title="Xem chi tiết" aria-label="Xem chi tiết ${esc(x.name)}"
                class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg border border-primary-100 text-primary-600 hover:bg-primary-50">${ICONS.eye}</button></li>`;
    }

    detail(x) {
        const off = x.status !== 'ACTIVE';
        return openDialog({
            title: 'Chi tiết nhân viên', width: 440,
            render: (body, close) => {
                const row = (k, v) => `<dt class="font-semibold text-secondary-700">${k}</dt><dd class="min-w-0 break-words font-medium">${v}</dd>`;
                body.innerHTML = `
                <dl class="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-3 text-sm">
                    ${row('Họ tên', esc(x.name))}
                    ${row('Vai trò', (x.roleNames ?? []).map(n => chip(cap(n), off ? 'gray' : 'green')).join(' ') || '—')}
                    ${row('Email', esc(x.email))}
                    ${row('Số điện thoại', esc(x.phoneNumber || '—'))}
                    ${row('Lương cơ bản', fmtMoney(x.salary))}
                    ${x.workFrom ? row('Ngày vào làm', esc(x.workFrom)) : ''}
                    ${row('Trạng thái', `<b class="${off ? 'text-red-500' : 'text-primary-700'}">${off ? 'Đã nghỉ' : 'Đang làm'}</b>`)}
                </dl>
                <div class="mt-6 grid gap-3 md:flex md:justify-center">
                    <p-button data-act="edit" label="Sửa" icon="edit" ${off ? 'disabled' : ''} class="block md:inline-block"></p-button>
                    <p-button data-act="terminate" label="Tạm ngưng" icon="pause" variant="danger" ${off ? 'disabled' : ''} class="block md:inline-block"></p-button>
                    <p-button data-act="close" label="Đóng" class="block md:inline-block"></p-button>
                </div>`;
                bindActions(body, { edit: () => close('edit'), terminate: () => close('terminate'), close: () => close() });
            },
        });
    }

    row(x) {
        const off = x.status !== 'ACTIVE';
        return `<tr class="border-b border-primary-50 last:border-0 ${off ? 'text-secondary-700' : ''}">
            <td class="px-3 py-3 font-bold">${esc(x.name)}</td>
            <td class="px-3 py-3">${(x.roleNames ?? []).map(n => chip(cap(n), off ? 'gray' : 'green')).join(' ') || '—'}</td>
            <td class="max-w-52 truncate px-3 py-3" title="${esc(x.email)}">${esc(x.email)}</td>
            <td class="px-3 py-3">${esc(x.phoneNumber || '—')}</td>
            <td class="px-3 py-3 text-right tabular-nums">${fmtMoney(x.salary)}</td>
            <td class="px-3 py-3 text-center font-bold ${off ? 'text-red-500' : 'text-primary-700'}">${off ? 'Đã nghỉ' : 'Đang làm'}</td>
            <td class="px-3 py-3"><div class="flex justify-end gap-1">
                <button type="button" data-act="edit" data-id="${x.id}" ${off ? 'disabled' : ''} title="Sửa vai trò / lương" aria-label="Sửa ${esc(x.name)}"
                    class="grid size-9 cursor-pointer place-items-center rounded-lg text-primary-600 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-30">${ICONS.edit}</button>
                <button type="button" data-act="terminate" data-id="${x.id}" ${off ? 'disabled' : ''} title="Cho nghỉ việc" aria-label="Cho ${esc(x.name)} nghỉ việc"
                    class="grid size-9 cursor-pointer place-items-center rounded-lg text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30">${ICONS.pause}</button>
            </div></td></tr>`;
    }

    onInput(e) { if (e.target.matches('[data-q]')) { this.state.q = e.target.value; this.draw(); this.querySelector('[data-q]').focus(); } }
    onChange(e) {
        if (e.target.matches('[data-status]')) this.state.status = e.target.value;
        else if (e.target.matches('[data-role]')) this.state.role = e.target.value;
        else return;
        this.draw();
    }

    form({ staff = null }) {
        const { roles } = this.state;
        const edit = Boolean(staff);
        return openDialog({
            title: edit ? 'Sửa nhân viên' : 'Thêm nhân viên mới', width: 580,
            render: (body, close) => {
                const picked = new Set(staff?.roleIds ?? []);
                body.innerHTML = `
                <form class="grid gap-4" novalidate>
                    ${edit ? notice('Backend chỉ cho cập nhật <b>vai trò</b> và <b>lương</b>. Tên, email, số điện thoại không đổi được.', 'green') : ''}
                    <div class="grid gap-4 sm:grid-cols-2">
                        ${field('Tên nhân viên', `<input name="name" class="${INPUT_CLS}" maxlength="100" value="${esc(staff?.name)}" ${edit ? 'disabled' : 'required'} autocomplete="off">`)}
                        ${field('Số điện thoại', `<input name="phone" class="${INPUT_CLS}" inputmode="tel" value="${esc(staff?.phoneNumber)}" ${edit ? 'disabled' : ''} autocomplete="off">`)}
                    </div>
                    ${field('Email đăng nhập (đuôi @gmail.com)', `<input name="email" type="email" class="${INPUT_CLS}" value="${esc(staff?.email)}" ${edit ? 'disabled' : 'required'} autocomplete="off">`)}
                    ${edit ? '' : field('Mật khẩu cấp cho nhân viên', `<div class="flex gap-2">
                        <input name="password" type="text" class="${INPUT_CLS}" minlength="8" autocomplete="new-password" spellcheck="false" placeholder="Tối thiểu 8 ký tự">
                        <p-button data-act="gen" label="Tạo ngẫu nhiên" icon="plus"></p-button></div>`, 'Nhân viên đăng nhập được ngay, không cần OTP. Hãy ghi lại mật khẩu để gửi cho nhân viên.')}
                    <div class="grid gap-4 sm:grid-cols-2">
                        ${field('Lương cơ bản (VNĐ/tháng)', `<input name="salary" type="number" min="1" step="1000" class="${INPUT_CLS}" value="${staff?.salary ?? ''}" required>`)}
                        ${field('Ngày vào làm', `<input name="workFrom" type="date" class="${INPUT_CLS}" value="${esc(staff?.workFrom ?? ymd())}" ${edit ? 'disabled' : 'required'}>`)}
                    </div>
                    <fieldset class="grid gap-2">
                        <legend class="mb-1.5 text-sm font-semibold">Vai trò (chọn một hoặc nhiều)</legend>
                        <div class="flex flex-wrap gap-2">${roles.map(r => `
                            <label class="cursor-pointer"><input type="checkbox" name="role" value="${r.id}" ${picked.has(r.id) ? 'checked' : ''} class="peer sr-only">
                                <span class="inline-block rounded-full border-2 border-primary-100 px-3.5 py-1.5 text-sm font-bold text-secondary-800 transition-all peer-checked:border-primary-600 peer-checked:bg-primary-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary-300">${esc(cap(r.name))}</span></label>`).join('')}</div>
                    </fieldset>
                    <p data-err role="alert" class="hidden text-sm font-semibold text-red-600"></p>
                    <div class="flex justify-center gap-3 pt-1">
                        <p-button type="submit" data-act="submit" label="${edit ? 'Lưu chỉnh sửa' : 'Tạo nhân viên'}" icon="check" variant="solid"></p-button>
                        <p-button data-act="cancel" label="Huỷ"></p-button>
                    </div>
                </form>`;
                const form = body.querySelector('form'), err = body.querySelector('[data-err]');
                const fail = m => { err.textContent = m; err.classList.remove('hidden'); };
                const submit = async () => {
                    const f = new FormData(form);
                    const data = {
                        name: String(f.get('name') ?? '').trim(), phoneNumber: String(f.get('phone') ?? '').trim(),
                        email: String(f.get('email') ?? '').trim(), password: String(f.get('password') ?? ''),
                        salary: Number(f.get('salary')), workFrom: f.get('workFrom'), roleIds: f.getAll('role').map(Number),
                    };
                    if (!edit && !data.name) return fail('Nhập tên nhân viên');
                    if (!edit && !/^[^\s@]+@gmail\.com$/i.test(data.email)) return fail('Email phải có đuôi @gmail.com');
                    if (!edit && data.password.length < 8) return fail('Mật khẩu cần ít nhất 8 ký tự');
                    if (!(data.salary > 0)) return fail('Lương phải lớn hơn 0');
                    if (!data.roleIds.length) return fail('Chọn ít nhất 1 vai trò');
                    close({ data });
                };
                form.addEventListener('submit', e => { e.preventDefault(); submit(); });
                bindActions(body, {
                    gen: () => { form.elements.password.value = genPassword(); },
                    cancel: () => close(),
                });
            },
        });
    }

    credentials(st, password) {
        return openDialog({
            title: 'Tài khoản nhân viên', width: 420,
            render: (body, close) => {
                body.innerHTML = `
                <div class="grid gap-3 text-sm">
                    <p class="text-center">Đã tạo tài khoản cho <b>${esc(st.name)}</b>. Mật khẩu chỉ hiện ở đây một lần.</p>
                    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-neutral-50 p-4">
                        <dt class="font-semibold">Email</dt><dd class="font-mono break-all">${esc(st.email)}</dd>
                        <dt class="font-semibold">Mật khẩu</dt><dd class="font-mono break-all">${esc(password)}</dd>
                    </dl>
                    <div class="flex justify-center gap-3 pt-1">
                        <p-button data-act="copy" label="Sao chép" icon="check"></p-button>
                        <p-button data-act="done" label="Xong" variant="solid"></p-button>
                    </div>
                </div>`;
                bindActions(body, {
                    copy: async () => toast(await copyText(`Email: ${st.email}\nMật khẩu: ${password}`) ? 'Đã sao chép' : 'Không sao chép được, hãy chép tay', 'success'),
                    done: () => close(),
                });
            },
        });
    }

    actions() {
        const acts = {
            view: async el => {
                const st = this.state.staff.find(x => x.id === Number(el.dataset.id));
                const next = st && await this.detail(st);
                if (next) acts[next]({ dataset: { id: st.id } });
            },
            add: async () => {
                const res = await this.form({});
                if (!res) return;
                const st = await this.run(() => hr.createStaff(res.data), 'Đã tạo nhân viên');
                if (st) await this.credentials(st, res.data.password);
            },
            edit: async el => {
                const staff = this.state.staff.find(x => x.id === Number(el.dataset.id));
                const res = staff && await this.form({ staff });
                if (res) this.run(() => hr.updateStaff(staff.id, { salary: res.data.salary, roleIds: res.data.roleIds }), 'Đã cập nhật nhân viên');
            },
            terminate: async el => {
                const st = this.state.staff.find(x => x.id === Number(el.dataset.id));
                if (!st) return;
                const ok = await confirmDialog({ title: 'Xoá nhân viên', message: `Xác nhận cho nhân viên ${st.name} nghỉ việc hay không? Nhân viên sẽ bị gỡ toàn bộ vai trò tại cửa hàng này. Các ca đã xếp không tự bị huỷ, hãy xoá chúng ở bước Xếp lịch.`, confirmLabel: 'Xoá', confirmIcon: 'delete', variant: 'danger' });
                if (ok) this.run(() => hr.terminateStaff(st.id), 'Đã cho nghỉ việc');
            },
        };
        return acts;
    }
}

customElements.define('hr-staff', StaffPanel);
