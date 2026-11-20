// Vùng nội dung đánh dấu bằng [data-swap].
const TRIGGERS = '[role="tab"], .sr-toggle, [data-act="tab"], [data-act="select-area"], [data-act="filter"], [data-nav], a[href^="#"], [data-step]';
let armedUntil = 0;
const reduce = () => document.documentElement.dataset.motion === 'off'
    || (document.documentElement.dataset.motion !== 'on' && matchMedia('(prefers-reduced-motion: reduce)').matches);

document.addEventListener('click', e => { if (e.target.closest?.(TRIGGERS)) armedUntil = performance.now() + 900; }, true);

const play = el => { el.classList.remove('sr-swap'); void el.offsetWidth; el.classList.add('sr-swap'); };

new MutationObserver(list => {
    if (performance.now() > armedUntil || reduce()) return;
    const hit = new Set();
    for (const m of list) {
        const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        const el = t?.closest?.('[data-swap]');
        if (el) hit.add(el);
    }
    hit.forEach(play);
}).observe(document.documentElement, { childList: true, subtree: true });
