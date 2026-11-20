import '../components/PrimaryButton.js';
import { esc } from './format.js';
import { NO_CONTENT } from '../config.js';
import { ICONS } from '../icon.js';

export function openDialog({ title, width = 480, render }) {
    return new Promise(resolve => {
        const dlg = document.createElement('dialog');
        dlg.className = 'sr-dialog m-auto overflow-hidden rounded-2xl bg-white p-0 text-text shadow-2xl';
        dlg.style.width = `min(94vw, ${width}px)`;
        dlg.innerHTML = `
            <header class="relative bg-primary-50 px-10 py-2 text-center text-sm font-bold uppercase text-text">
                ${esc(title)}
            </header>
            <div data-body class="min-h-0 max-h-[70vh] p-5 overflow-x-hidden overflow-y-auto scrollbar-thin scroll-smooth scrollbar-thumb-primary-100"></div>
        `;

        let result;
        const close = value => {
            result = value;
            if (dlg.dataset.closing || matchMedia('(prefers-reduced-motion: reduce)').matches) { dlg.close(); return; }
            dlg.dataset.closing = '1';
            const done = () => dlg.close();
            dlg.addEventListener('animationend', done, { once: true });
            setTimeout(done, 400);

        };
        dlg.addEventListener('cancel', e => { e.preventDefault(); close(undefined); });
        dlg.addEventListener('close', () => {
            dlg.remove();
            resolve(result);
        });
        dlg.addEventListener('click', e => {
            if (e.target === dlg) close();
        });

        document.body.append(dlg);
        render(dlg.querySelector('[data-body]'), close, dlg);
        dlg.showModal();
    });
}

export function bindActions(root, handlers, { capture = false } = {}) {
    root.addEventListener('click', e => {
        const el = e.target.closest('[data-act]');
        if (!el || !root.contains(el) || el.hasAttribute('disabled')) {
            return;
        }
        handlers[el.dataset.act]?.(el, e);
    }, capture);
}

export function confirmDialog({ title, message, confirmLabel = 'Xác nhận', confirmIcon = 'check', variant = 'solid' }) {
    return openDialog({
        title, width: 380,
        render(body, close) {
            body.innerHTML = `
                <p class="px-2 pt-2 text-center text-sm leading-relaxed">
                    ${esc(message)}
                </p>
                <div class="mt-6 flex justify-center gap-3">
                    <p-button data-act="ok" label="${esc(confirmLabel)}" icon="${confirmIcon}" variant="${variant}"></p-button>
                    <p-button data-act="cancel" label="Huỷ"></p-button>
                </div>
            `;
            bindActions(body, {
                ok: () => close(true),
                cancel: () => close(false)
            });
        },
    }).then(Boolean);
}

const TOAST = {
    error: ['border-danger-fg bg-danger-bg text-danger-fg', 'warning', 'alert'],
    success: ['border-ok-fg bg-ok-bg text-ok-fg', 'check', 'status'],
    warn: ['border-warn-ac bg-warn-bg text-warn-fg', 'warning', 'alert'],
    info: ['border-honey bg-honey-soft text-primary-900', 'info', 'status'],
};


export function toast(message, type = 'error') {
    if (message === NO_CONTENT) return; // thiếu quyền: ẩn đi, không báo lỗi
    let host = document.getElementById('toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toast-host';
        host.setAttribute('popover', 'manual');
        host.style.cssText = 'margin:0; inset:16px 16px auto auto; display:flex; flex-direction:column; align-items:flex-end; gap:8px; overflow:visible; border:0; background:transparent; padding:0; max-width:calc(100vw - 32px);';
        document.body.append(host);
    }

    const [cls, ic, role] = TOAST[type] ?? TOAST.info;
    const el = document.createElement('div');
    el.setAttribute('role', role);
    el.className = `sr-toast flex max-w-sm items-start gap-2.5 rounded-2xl border-l-4 px-4 py-3 text-sm font-semibold shadow-xl ${cls}`;
    el.innerHTML = `<span class="mt-0.5 shrink-0">${ICONS[ic] ?? ''}</span><span class="text-sm leading-snug" style="color:inherit;font-weight:600"></span>`;
    el.lastElementChild.textContent = message;
    host.append(el);

    try { host.hidePopover(); } catch { }
    try { host.showPopover(); } catch { }

    const leave = () => {
        el.dataset.leaving = '1';
        setTimeout(() => {
            el.remove();
            if (!host.children.length) { try { host.hidePopover(); } catch { } }
        }, 260);
    };
    el.addEventListener('click', leave);
    setTimeout(leave, type === 'success' ? 2600 : 4200);
}