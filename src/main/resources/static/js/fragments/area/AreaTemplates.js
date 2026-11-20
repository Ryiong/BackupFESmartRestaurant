import { esc, money, moneyK, hhmm, minutesSince, orderTotal, effectiveCapacity, STATUS, INPUT_CLS, titleCase } from '../../utils/format.js';

const CARD = 'rounded-2xl bg-neutral-100 p-4';
const LABEL = 'text-sm text-secondary-700';
const DIVIDER = '<hr class="my-3 border-primary-200">';

const title = '<h2 class="mb-3 text-xl font-bold text-text">Chi tiết bàn</h2>';
const closeBtn = '<p-button data-act="close-detail" label="Đóng" icon="close" variant="danger"></p-button>';

const qrBlock = table => `
    <div class="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-white p-3">
        <span class="text-sm font-semibold">QR gọi món</span>
        <button type="button" role="switch" aria-checked="${!!table.qrEnabled}" aria-label="Bật/tắt QR gọi món" data-act="toggle-qr"
            class="sr-switch"></button>
        ${table.qrEnabled ? '<p-button data-act="show-qr" label="Xem QR" icon="qr"></p-button>' : '<span class="text-xs text-secondary-700">Đang tắt</span>'}
    </div>`;

const info = (label, value) => `<p class="${LABEL}">${label}: <b class="text-text">${value}</b></p>`;

const header = (table, status) => `
    <div class="mb-2 flex items-start justify-between gap-2">
        <h3 class="text-xl font-bold text-primary-700">${esc(titleCase(table.name))}</h3>
        <span class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS[status].badge}">${STATUS[status].panel}</span>
    </div>`;

const orderList = (orders, { allowDelete = false } = {}) => {
    const list = orders ?? [];
    if (!list.length) return '<p class="text-sm text-secondary-700">Chưa có món nào.</p>';
    return `<ul class="space-y-1.5 text-sm">${list.map(o => {
        const inactive = o.status && String(o.status).toUpperCase() === 'INACTIVE';
        const note = o.note ? `<span class="block text-xs text-secondary-600">Ghi chú: ${esc(o.note)}</span>` : '';
        const deletedMeta = inactive && (o.deletedBy || o.deletedAt)
            ? `<span class="block text-xs text-danger-fg">Đã xoá${o.deletedBy ? ` bởi ${esc(o.deletedBy)}` : ''}${o.deletedAt ? ` · ${hhmm(o.deletedAt)}` : ''}</span>`
            : '';
        const delBtn = allowDelete && !inactive && o.id
            ? `<p-button type="button" data-act="delete-item" data-id="${esc(o.id)}" aria-label="Xoá ${esc(titleCase(o.name))}"
                label="Xoá" icon="delete" variant="danger"></p-button>`
            : '';
        return `<li class="flex items-center justify-between gap-3 ${inactive ? 'hidden' : ''}">
            <span class="min-w-0 text-sm font-semibold ${inactive ? 'line-through' : ''}">${o.qty} x ${esc(titleCase(o.name))}${note}${deletedMeta}</span>
            <span class="flex shrink-0 items-center gap-2">
                <b class="${inactive ? 'line-through text-secondary-600' : 'text-sm'}">${moneyK(o.price * o.qty)}</b>
                ${delBtn}
            </span>
        </li>`;
    }).join('')}</ul>`;
};

export function emptyDetailHtml(hasArea) {
    return `${title}
        <div class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-primary-200 px-4 py-14 text-center">
            <span class="text-primary-300">${'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="size-10"><rect x="3" y="9" width="18" height="4" rx="1.5"/><path d="M6 13v7M18 13v7M9 9V6h6v3"/></svg>'}</span>
            <p class="text-sm text-secondary-700">${hasArea ? 'Chọn một bàn trên sơ đồ để xem chi tiết' : 'Chưa có khu vực nào được chọn'}</p>
        </div>`;
}

export function detailHtml({ table, area, pay }) {
    const tables = area.tables;
    const maxGuests = effectiveCapacity(table, tables);
    const total = orderTotal(table);

    switch (table.status) {
        case 'empty':
            return `${title}
                <div class="${CARD}">
                    ${header(table, 'empty')}
                    <div class="space-y-1">${info('Khu vực', esc(titleCase(area.name)))}${info('Số khách tối đa', maxGuests)}</div>
                    <div class="mt-3"><p-button data-act="open-table" label="Sử dụng bàn" icon="utensils"></p-button></div>
                    ${qrBlock(table)}
                </div>
                ${DIVIDER}${closeBtn}`;

        case 'reserved':
            return `${title}
                <div class="${CARD}">
                    ${header(table, 'reserved')}
                    <div class="space-y-1">
                        ${info('Khu vực', esc(titleCase(area.name)))}
                        <div class="flex flex-wrap gap-x-4">${info('Giờ đặt bàn', hhmm(table.reservedAt))}${info('Giờ hết hạn', hhmm(table.reservedUntil))}</div>
                        ${info('Số khách tối đa', maxGuests)}
                    </div>
                    <div class="mt-3"><p-button data-act="open-table" label="Sử dụng bàn" icon="utensils"></p-button></div>
                </div>
                ${DIVIDER}
                <div class="flex flex-col items-start gap-2.5">
                    <p-button data-act="cancel-reserve" label="Huỷ bàn đặt trước" icon="close" variant="danger"></p-button>
                    ${closeBtn}
                </div>`;

        case 'merged': {
            const primary = tables.find(t => t.id === table.mergedInto);
            return `${title}
                <div class="${CARD}">
                    ${header(table, 'merged')}
                    <div class="space-y-1">
                        ${info('Khu vực', esc(titleCase(area.name)))}
                        ${info('Đã gộp vào', primary ? esc(titleCase(primary.name)) : '-')}
                    </div>
                    ${primary ? '<div class="mt-3"><p-button data-act="goto-primary" label="Xem bàn chính" icon="merge"></p-button></div>' : ''}
                </div>
                ${DIVIDER}${closeBtn}`;
        }

        case 'serving': {
            const merged = (table.mergedIds ?? []).map(id => titleCase(tables.find(t => t.id === id)?.name)).filter(Boolean);
            const activeCount = (table.orders ?? []).filter(o => !o.status || String(o.status).toUpperCase() === 'ACTIVE').length;
            return `${title}
                <div class="${CARD}">
                    ${header(table, 'serving')}
                    <div class="space-y-1">
                        ${info('Khu vực', esc(titleCase(area.name)))}
                        ${info('Giờ vào', `${hhmm(table.startedAt)} <span class="font-normal">(Đã dùng ${minutesSince(table.startedAt)} phút)</span>`)}
                        ${table.guests > 0 ? info('Số khách đang có', table.guests) : ''}
                        ${info('Số khách tối đa', maxGuests)}
                        ${merged.length ? info('Bàn đã gộp', esc(merged.join(', '))) : ''}
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2.5">
                        <p-button data-act="merge" label="Gộp bàn" icon="merge"></p-button>
                        <p-button data-act="move" label="Chuyển bàn" icon="swap"></p-button>
                    </div>
                    ${qrBlock(table)}
                </div>
                <h4 class="mb-2 mt-4 text-[15px] font-bold">Danh sách đặt món (${activeCount} món)</h4>
                ${orderList(table.orders, { allowDelete: true })}
                ${DIVIDER}
                <div class="flex items-center justify-between">
                    <span class="font-bold">Tạm tính</span><b class="text-lg text-primary-700">${money(total)}</b>
                </div>
                <div class="mt-3 flex flex-col items-start gap-2.5">
                    <p-button data-act="order" label="Đặt món" icon="plus"></p-button>
                    <p-button data-act="pay" label="THANH TOÁN" variant="solid" ${activeCount ? '' : 'disabled'}></p-button>
                    ${activeCount ? '' : '<p class="text-xs text-secondary-700">Cần đặt ít nhất 1 món để thanh toán.</p>'}
                    ${closeBtn}
                </div>`;
        }

        case 'paying': {
            const received = pay.received;
            const canPay = pay.method === 'transfer' || received >= total;
            const methodBtn = (v, label) => `
                <button type="button" data-act="pay-method" data-v="${v}" aria-pressed="${pay.method === v}"
                     class="sr-toggle sr-seg flex-1">${label}</button>`;
            return `${title}
                <div class="${CARD}">
                    ${header(table, 'paying')}
                    <div class="grid grid-cols-2 gap-x-3 gap-y-1">
                        ${table.guests > 0 ? info('Số khách', table.guests) : ''}${info('Khu vực', esc(titleCase(area.name)))}
                        ${info('Giờ ra', hhmm(Date.now()))}${info('Giờ vào', hhmm(table.startedAt))}
                    </div>
                </div>
                <h4 class="mb-2 mt-4 text-[15px] font-bold">Danh sách đặt món (${(table.orders ?? []).filter(o => !o.status || String(o.status).toUpperCase() === 'ACTIVE').length} món)</h4>
                ${orderList(table.orders, { allowDelete: false })}
                ${DIVIDER}
                <div class="flex items-center justify-between">
                    <span class="font-bold">TỔNG THANH TOÁN</span><b class="text-lg text-primary-700">${money(total)}</b>
                </div>
                <h4 class="mb-2 mt-4 text-[15px] font-bold">Phương thức thanh toán</h4>
                <div class="flex gap-2 justify-around">${methodBtn('cash', 'Tiền mặt')}${methodBtn('transfer', 'Chuyển khoản')}</div>
                ${pay.method === 'cash' ? `
                <div class="mt-3 grid grid-cols-[96px_1fr] items-center gap-2">
                    <label for="pay-received" class="text-sm">Khách đưa</label>
                    <div class="relative">
                        <input id="pay-received" data-f="received" inputmode="numeric" autocomplete="off" value="${received ? received.toLocaleString('vi-VN') : ''}"
                            class="${INPUT_CLS} pr-8 text-right" placeholder="0">
                        <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-secondary-700">đ</span>
                    </div>
                    <span class="text-sm">Trả lại khách</span>
                    <output data-change class="rounded-xl border border-primary-200 bg-primary-50 px-3.5 py-2 text-right font-bold text-primary-700">${received >= total ? money(received - total) : '—'}</output>
                </div>
                <div class="mt-2 flex flex-wrap gap-1.5">
                    ${[total, 500000, 200000, 100000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v =>
                `<button type="button" data-act="quick-cash" data-v="${v}" class="cursor-pointer rounded-full border border-primary-200 bg-white px-2.5 py-1 text-xs font-bold text-primary-700 transition-all">${v === total ? 'Đủ ' : ''}${moneyK(v)}</button>`).join('')}
                </div>` : `
                <p class="mt-3 rounded-xl bg-neutral-100 p-3 text-sm text-secondary-700">Xác nhận sau khi nhận được ${money(total)} vào tài khoản của cửa hàng.</p>`}
                <div class="mt-4 flex flex-wrap gap-2.5">
                    <p-button data-act="checkout" label="Xác Nhận & Trả Bàn" variant="solid" icon="check" ${canPay ? '' : 'disabled'}></p-button>
                    <p-button data-act="cancel-pay" label="Quay lại"></p-button>
                </div>`;
        }
    }
    return '';
}