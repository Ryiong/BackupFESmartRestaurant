// <settings-hub>: menu 6 bước bên trái + panel nội dung bên phải, điều hướng bằng location.hash.
import './hr/RolePanel.js';
import './hr/StaffPanel.js';
import './hr/ShiftPanel.js';
import './hr/SchedulePanel.js';
import './hr/AttendancePanel.js';
import './hr/PayrollPanel.js';
import { hr, ymd, addDays } from '../services/HrService.js';
import { esc } from './hr/ui.js';
import { ICONS } from '../icon.js';

const STEPS = [
    { key: 'roles', tag: 'hr-roles', icon: 'shield', label: 'Vai trò & phân quyền', desc: 'Tạo các vai trò của cửa hàng và chọn quyền cho từng vai trò.' },
    { key: 'staff', tag: 'hr-staff', icon: 'users', label: 'Nhân viên', desc: 'Đăng ký nhân viên, cấp tài khoản – mật khẩu và gán vai trò.' },
    { key: 'shifts', tag: 'hr-shifts', icon: 'clock', label: 'Ca kíp', desc: 'Định nghĩa các ca làm việc và khung giờ.' },
    { key: 'schedule', tag: 'hr-schedule', icon: 'calendar', label: 'Xếp lịch', desc: 'Phân ca cho nhân viên theo ngày.' },
    { key: 'attendance', tag: 'hr-attendance', icon: 'fingerprint', label: 'Chấm công', desc: 'Theo dõi giờ vào/ra và duyệt công.' },
    { key: 'payroll', tag: 'hr-payroll', icon: 'wallet', label: 'Tính công', desc: 'Tổng hợp công đã duyệt theo tháng và ước tính lương.' },
];

class SettingsHub extends HTMLElement {
    summary = {};

    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.classList.add('block');
        this.innerHTML = `
        <div class="grid items-start gap-4 pb-6 2xl:grid-cols-[250px_minmax(0,1fr)]">
            <nav aria-label="Các bước thiết lập" class="rounded-2xl bg-white p-3 shadow-sm 2xl:sticky 2xl:top-4">
                <p class="px-3 pt-2 pb-3 text-xs font-bold uppercase tracking-wide text-secondary-700">Thiết lập nhân sự</p>
                <ol data-steps class="flex gap-1 overflow-x-auto 2xl:flex-col"></ol>
            </nav>
            <div class="min-w-0">
                <div class="mb-4"><h2 data-title class="text-lg font-bold"></h2><p data-desc class="text-sm text-secondary-700"></p></div>
                <div data-outlet></div>
            </div>
        </div>`;
        this.steps = this.querySelector('[data-steps]');
        this.outlet = this.querySelector('[data-outlet]');
        this.onHash = () => this.show();
        this.onChanged = () => {
            // Một thao tác ghi có thể phát nhiều sự kiện; gom lại để không bắn loạt request tính số liệu.
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.refreshSummary(), 300);
        };
        window.addEventListener('hashchange', this.onHash);
        window.addEventListener('hr:changed', this.onChanged);
        this.show();
        this.refreshSummary();
    }

    disconnectedCallback() {
        window.removeEventListener('hashchange', this.onHash);
        window.removeEventListener('hr:changed', this.onChanged);
        clearTimeout(this.timer);
        delete this.dataset.ready;
    }

    get key() { const k = location.hash.slice(1); return STEPS.some(s => s.key === k) ? k : STEPS[0].key; }

    show() {
        const step = STEPS.find(s => s.key === this.key);
        this.querySelector('[data-title]').textContent = step.label;
        this.querySelector('[data-desc]').textContent = step.desc;
        if (this.outlet.firstElementChild?.localName !== step.tag) this.outlet.replaceChildren(document.createElement(step.tag));
        this.drawSteps();
    }

    async refreshSummary() {
        try {
            const [roles, staff, shifts, week] = await Promise.all([hr.listRoles(), hr.listStaff(), hr.listShifts(), hr.listScheduleRange(ymd(), addDays(ymd(), 6))]);
            this.summary = {
                roles: roles.length, staff: staff.filter(s => s.status === 'ACTIVE').length,
                shifts: shifts.filter(s => s.status === 'ACTIVE').length, schedule: week.length,
            };
        } catch { this.summary = {}; }
        this.drawSteps();
    }

    drawSteps() {
        const sub = { roles: 'vai trò', staff: 'nhân viên', shifts: 'ca kíp', schedule: 'ca trong 7 ngày tới' };
        this.steps.innerHTML = STEPS.map((s, i) => {
            const on = s.key === this.key, n = this.summary[s.key], done = n > 0;
            return `<li class="shrink-0 grow 2xl:grow-0"><a href="#${s.key}" ${on ? 'aria-current="step"' : ''}
                class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all hover:bg-neutral-50 ${on ? 'bg-primary-50 text-primary-800' : 'text-secondary-800'}">
                <span class="grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-primary-600 text-white' : on ? 'bg-white text-primary-700 ring-2 ring-primary-300' : 'bg-neutral-100 text-secondary-700'}">${done ? '✓' : i + 1}</span>
                <span class="grid"><span class="text-sm font-bold whitespace-nowrap">${esc(s.label)}</span>
                ${sub[s.key] && n !== undefined ? `<span class="text-xs font-medium text-secondary-700">${n} ${sub[s.key]}</span>` : ''}</span></a></li>`;
        }).join('');
    }
}

customElements.define('settings-hub', SettingsHub);
