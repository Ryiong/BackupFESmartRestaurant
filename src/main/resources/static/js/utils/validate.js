// Dùng:  const ok = check(body, [['[data-f="name"]', v => !v.trim() && 'Vui lòng nhập tên']])
//        invalid(input, 'Nội dung lỗi')  /  clearInvalid(root)

const ERR_ATTR = 'data-field-error';

const errorBox = input => {
    let box = input.parentElement?.querySelector(`[${ERR_ATTR}="${input.id || input.name || ''}"]`);
    if (box) return box;
    box = document.createElement('p');
    box.className = 'sr-form-error';
    box.setAttribute('role', 'alert');
    box.setAttribute(ERR_ATTR, input.id || input.name || '');
    (input.closest('[data-field]') ?? input).after(box);
    return box;
};

export function clearInvalid(target) {
    const input = target?.matches?.('input,select,textarea') ? target : null;
    if (input) {
        input.removeAttribute('aria-invalid');
        input.classList.remove('sr-shake');
        const id = input.id || input.name || '';
        input.parentElement?.querySelector(`[${ERR_ATTR}="${id}"]`)?.remove();
        return;
    }
    target?.querySelectorAll?.('[aria-invalid="true"]').forEach(clearInvalid);
}

export function invalid(input, message, { focus = true } = {}) {
    if (!input) return false;
    input.setAttribute('aria-invalid', 'true');
    errorBox(input).textContent = message;
    input.classList.remove('sr-shake'); void input.offsetWidth; input.classList.add('sr-shake');
    if (focus) input.focus({ preventScroll: false });
    if (!input.dataset.srClear) {
        input.dataset.srClear = '1';
        input.addEventListener('input', () => clearInvalid(input));
        input.addEventListener('change', () => clearInvalid(input));
    }
    return false;
}

// rules: [[selector, (value, el) => string|false]] — trả về true nếu hợp lệ; lỗi đầu tiên được focus.
export function check(root, rules) {
    clearInvalid(root);
    let first = null;
    for (const [sel, rule] of rules) {
        const el = root.querySelector(sel);
        if (!el) continue;
        const msg = rule(el.value, el);
        if (msg) { invalid(el, msg, { focus: !first }); first ??= el; }
    }
    return !first;
}
