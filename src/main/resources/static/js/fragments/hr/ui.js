import '../../components/PrimaryButton.js';
import { esc, INPUT_CLS } from '../../utils/format.js';
import { bindActions, toast } from '../../utils/dialog.js';
import { parseYmd, ymd, cap } from '../../services/HrService.js';
import { ICONS } from '../../icon.js';


export { esc, INPUT_CLS, bindActions, toast, cap };

export const TH = 'px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-primary-700';
export const CARD = 'rounded-2xl bg-white p-5 shadow-sm';
export const SELECT_CLS = `${INPUT_CLS} cursor-pointer !w-auto !py-1.5 text-sm font-semibold text-primary-700`;

const CHIP = {
    green: 'bg-primary-50 text-primary-800',
    red: 'bg-red-100 text-red-700',
    amber: 'bg-amber-100 text-amber-800',
    gray: 'bg-neutral-100 text-secondary-800',
    sky: 'bg-sky-100 text-sky-900',
};

export const chip = (text, tone = 'gray') =>
    `<span class="inline-block rounded-full whitespace-nowrap px-2.5 py-0.5 text-xs font-bold ${CHIP[tone]}">${esc(text)}</span>`;

export const field = (label, inner, hint = '') => `
    <label class="grid gap-1.5 text-sm font-semibold">
        <span>${esc(label)}</span>${inner}
        ${hint ? `<span class="text-xs font-medium text-secondary-700">${esc(hint)}</span>` : ''}
    </label>`;

export const notice = (html, tone = 'amber') => `
    <div class="flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${tone === 'amber' ? 'bg-amber-50 text-amber-900' : 'bg-primary-50/60 text-primary-800'}">
        <span class="mt-0.5 shrink-0">${ICONS.info}</span><div>${html}</div>
    </div>`;

export const emptyState = (title, sub = '') => `
    <div class="grid place-items-center gap-1 py-14 text-center">
        <p class="font-bold text-primary-800">${esc(title)}</p>
        ${sub ? `<p class="max-w-sm text-sm text-secondary-700">${esc(sub)}</p>` : ''}
    </div>`;

export const WEEKDAY = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
export const dmy = s => { const d = parseYmd(s); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };
export const dayLabel = s => `${WEEKDAY[parseYmd(s).getDay()]} (${dmy(s)})`;
export const clock = iso => iso ? String(iso).slice(11, 16) : '—';
export const isToday = s => s === ymd();

export const fmtMoney = n => `${Math.round(n).toLocaleString('vi-VN')} đ`;

export class HrPanel extends HTMLElement {
    connectedCallback() {
        if (this.dataset.ready) return;
        this.dataset.ready = '1';
        this.classList.add('block');
        this.loading = true;
        this.build?.();
        bindActions(this, this.actions?.() ?? {});
        this.addEventListener('input', e => this.onInput?.(e));
        this.addEventListener('change', e => this.onChange?.(e));
        this.reload();
    }

    async reload() {
        // Đổi ngày/tháng nhanh có thể làm phản hồi cũ về sau phản hồi mới -> chỉ nhận kết quả của lần gọi mới nhất.
        const seq = this._seq = (this._seq ?? 0) + 1;
        try { await this.load(); this.error = null; } catch (err) {
            if (seq !== this._seq) return;
            this.error = err.message || 'Không tải được dữ liệu';
            toast(this.error);
        }
        if (seq !== this._seq) return;
        this.loading = false;
        this.draw();
    }

    /** Chạy một thao tác ghi: chống bấm đúp, báo thành công / lỗi, rồi nạp lại. */
    async run(fn, okMsg) {
        if (this._busy) return undefined;
        this._busy = true;
        try {
            const r = await fn();
            if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'success');
            window.dispatchEvent(new CustomEvent('hr:changed'));
            await this.reload();
            return r;
        } catch (err) {
            toast(err.message || 'Có lỗi xảy ra');
            return undefined;
        } finally { this._busy = false; }
    }
}

export const copyText = async text => {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
};