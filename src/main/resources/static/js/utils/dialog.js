import '../components/PrimaryButton.js';
import { esc } from './format.js';

export function openDialog({ title, width = 480, render }) {
    return new Promise(resolve => {
        const dlg = document.createElement('dialog');
        dlg.className = 'm-auto overflow-hidden rounded-2xl bg-white p-0 text-text shadow-xl backdrop:bg-black/40';
        dlg.style.width = `min(94vw, ${width}px)`;
        dlg.innerHTML = `
            <header class="relative bg-primary-50 px-10 py-2 text-center text-sm font-bold uppercase text-primary-800">
                ${esc(title)}
            </header>
            <div data-body class="min-h-0 max-h-[70vh] p-5 overflow-x-hidden overflow-y-auto scrollbar-thin scroll-smooth scrollbar-thumb-primary-200"></div>
        `;

        let result;
        const close = value => {
            result = value;
            dlg.close();
        };
        dlg.addEventListener('close', () => {
            dlg.remove();
            resolve(result);
        });
        dlg.addEventListener('click', e => {
            if (e.target == dlg) close;
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

export function confirmDialog({ title, message, confirmLabel = 'Xác nhận', confirmIcon = 'check', variant = 'solid'}) {
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

export function toast(message, type = 'error') {
    let host = document.getElementById('toast-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'toast-host';
        host.setAttribute('popover', 'manual');
        host.style.cssText = 'margin:0; inset:auto; top:16px; right:16px; display:flex; flex-direction:column; gap:8px; overflow:visible; border:0; background:transparent; padding:0;';
        document.body.append(host);
    }

    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.className = 'max-w-sm rounded-xl border-2 bg-white px-4 py-2.5 text-sm font-semibold shadow-lg ' + 
        (type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-primary-50 text-primary-800');
    el.textContent = message;
    host.append(el);

    try { host.hidePopover(); } catch { }
    try { host.showPopover(); } catch { }

    setTimeout(() => {
        el.remove();
        if (!host.children.length) {
            try { host.hidePopover(); } catch { }
        }
    }, 3200);
}