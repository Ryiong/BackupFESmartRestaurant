export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => 
    ({ '&': '&amp',
        '<': '&lt',
        '>': '&gt',
        '"': '&quot',
        "'": '&#39;'
    }[c])
);

export const money = n => `${Math.round(n).toLocaleString('vi-VN')} đ`;

export const moneyK = n => (n % 1000 === 0  ? `${n/1000}k` : money(n));

export const hhmm = ts => new Date(ts).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
});

export const titleCase = s =>
    String(s ?? '')
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .map(w => (w ? w[0].toLocaleUpperCase('vi') + w.slice(1) : w))
        .join(' ');

export const minutesSince = ts => Math.max(0, Math.floor((Date.now() - ts) / 60000));

export const orderTotal = t => (t?.orders ?? []).reduce((s, o) => s + o.price * o.qty, 0);

export const effectiveCapacity = (table, tables) =>
    table.capacity + (table.mergedIds ?? []).reduce((s, id) => s + (tables.find(t => t.id === id)?.capacity ?? 0), 0);

export const STATUS = {
    empty: {
        label: 'TRỐNG',
        panel: 'TRỐNG',
        card: 'border-primary-200 bg-white',
        badge: 'bg-neutral-100 text-primary-500'
    },
    serving: {
        label: 'ĐANG PHỤC VỤ',
        panel: 'ĐANG PHỤC VỤ',
        card: 'border-primary-700 bg-primar-50',
        badge: 'bg-sky-100 text-sky-900'
    },
    paying: {
        label: 'ĐANG THANH TOÁN',
        panel: 'ĐANG THANH TOÁN',
        card: 'border-amber-500 bg-amber-50',
        badge: 'bg-amber-100 text-amber-800'
    },
    reserved: {
        label: 'ĐÃ ĐẶT TRƯỚC',
        panel: 'ĐÃ ĐẶT TRƯỚC',
        card: 'border-orange-600 bg-orange-50',
        badge: 'bg-orange-100 text-orange-700'
    },
    merged: {
        label: 'ĐÃ GỘP',
        panel: 'ĐÃ GỘP',
        card: 'border-dashed border-primary-300 bg-neutral-50',
        badge: 'bg-neutral-100 text-primary-700'
    },
}

export const INPUT_CLS = 'block w-full rounded-xl border border-support-600 bg-white px-3.5 py-2 text-text transition-color duration-200 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500';