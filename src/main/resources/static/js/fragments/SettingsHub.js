// <settings-hub>: menu 7 bước bên trái + panel nội dung bên phải, điều hướng bằng location.hash.
import './AppearancePanel.js';
import './hr/LocationPanel.js';
import './hr/RolePanel.js';
import './hr/StaffPanel.js';
import './hr/ShiftPanel.js';
import './hr/SchedulePanel.js';
import './hr/AttendancePanel.js';
import './hr/PayrollPanel.js';
import { hr, ymd, addDays } from '../services/HrService.js';
import { esc } from './hr/ui.js';
import { ICONS } from '../icon.js';
import { logout } from '../services/HttpClient.js';
import { getCurrentShop, getShopLocation } from '../services/ShopService.js';

const STEPS = [
    { group: 'Cửa hàng', key: 'location', tag: 'hr-location', icon: 'location', label: 'Cửa hàng & vị trí', desc: 'Thông tin cửa hàng, toạ độ và bán kính cho phép chấm công.' },
    { group: 'Nhân sự', key: 'roles', tag: 'hr-roles', icon: 'shield', label: 'Vai trò & phân quyền', desc: 'Tạo các vai trò của cửa hàng và chọn quyền cho từng vai trò.' },
    { key: 'staff', tag: 'hr-staff', icon: 'users', label: 'Nhân viên', desc: 'Đăng ký nhân viên, cấp tài khoản – mật khẩu và gán vai trò.' },
    { key: 'shifts', tag: 'hr-shifts', icon: 'clock', label: 'Ca kíp', desc: 'Định nghĩa các ca làm việc và khung giờ.' },
    { key: 'schedule', tag: 'hr-schedule', icon: 's_calendar', label: 'Xếp lịch', desc: 'Phân ca cho nhân viên theo ngày.' },
    { key: 'attendance', tag: 'hr-attendance', icon: 'fingerprint', label: 'Chấm công', desc: 'Theo dõi giờ vào/ra và duyệt công.' },
    { key: 'payroll', tag: 'hr-payroll', icon: 'wallet', label: 'Tính công', desc: 'Tổng hợp công đã duyệt theo tháng và ước tính lương.' },
    { group: 'Ứng dụng', key: 'appearance', tag: 'app-appearance', icon: 'setting', label: 'Giao diện', desc: 'Hoạt ảnh, màu chủ đạo và cỡ chữ cho thiết bị này.' },
];

class SettingsHub extends HTMLElement {
    summary = {};

    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.classList.add('block');
        this.innerHTML = `
        <div class="grid items-start gap-4 pb-6 2xl:grid-cols-[250px_minmax(0,1fr)]">
            <nav aria-label="Các bước thiết lập" class="min-w-0 rounded-2xl bg-white p-2 shadow-sm md:p-3 2xl:sticky 2xl:top-4">
                <ol data-steps class="flex gap-1 overflow-x-auto scroll-smooth pb-1 scrollbar-none 2xl:flex-col 2xl:overflow-visible"></ol>
            </nav>
            <div class="min-w-0">
                <div class="mb-3 md:mb-4"><h2 data-title class="text-lg font-bold"></h2><p data-desc class="text-sm text-secondary-700"></p></div>
                <div data-outlet data-swap></div>
                <p-button data-act="logout" label="Đăng xuất" icon="logout" variant="danger" class="mt-6"></p-button>
            </div>
        </div>`;
        this.steps = this.querySelector('[data-steps]');
        this.outlet = this.querySelector('[data-outlet]');
        this.addEventListener('click', e => { if (e.target.closest('[data-act=logout]')) logout(); });
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
            const [roles, staff, shifts, week, shop] = await Promise.all([hr.listRoles(), hr.listStaff(), hr.listShifts(), hr.listScheduleRange(ymd(), addDays(ymd(), 6)), getCurrentShop().catch(() => null)]);
            this.summary = {
                location: getShopLocation(shop) ? 1 : 0, roles: roles.length, staff: staff.filter(s => s.status === 'ACTIVE').length,
                shifts: shifts.filter(s => s.status === 'ACTIVE').length, schedule: week.length,
            };
        } catch { this.summary = {}; }
        this.drawSteps();
    }

    drawSteps() {
        const sub = { location: 'vị trí đã đặt', roles: 'vai trò', staff: 'nhân viên', shifts: 'ca kíp', schedule: 'ca trong 7 ngày tới' };
        let lastGroup = '';
        this.steps.innerHTML = STEPS.map(s => {
            const on = s.key === this.key, n = this.summary[s.key];
            const head = s.group !== lastGroup ? `<li aria-hidden="true" class="hidden px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-secondary-700 first:pt-1 2xl:block">${esc(s.group)}</li>` : '';
            lastGroup = s.group;
            return `${head}<li class="shrink-0 grow 2xl:grow-0"><a href="#${s.key}" data-step ${on ? 'aria-current="step"' : ''}
                class="sr-press flex min-h-11 items-center gap-2.5 rounded-xl border-l-4 px-2.5 py-2 md:px-3 ${on ? 'border-primary-600 bg-primary-100 font-bold text-primary-900' : 'border-transparent text-secondary-800 hover:bg-primary-50'}">
                <span class="shrink-0 ${on ? 'text-primary-700' : 'text-secondary-600'}">${ICONS[s.icon] ?? ''}</span>
                <span class="grid"><span class="text-sm font-bold whitespace-nowrap">${esc(s.label)}</span>
                ${sub[s.key] && n !== undefined ? `<span class="hidden text-xs md:block font-medium text-secondary-700">${n} ${sub[s.key]}</span>` : ''}</span></a></li>`;
        }).join('');
        this.steps.querySelector('[aria-current]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    }
}

customElements.define('settings-hub', SettingsHub);
