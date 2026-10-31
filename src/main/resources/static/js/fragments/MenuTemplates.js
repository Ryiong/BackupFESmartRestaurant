import { esc, money, titleCase } from "../utils/format";
import { ICONS } from "../icon";

const BADGE = 'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase';
const ICON_BTN = 'cursor-pointer rounded-lg p-1.5 text-primary-700 transition-all hover:scale-90 hover:bg-white';

export const noImageHtml = `
    <div class="flex size-full flex-col items-center justify-center gap-1 text-primary-300">
        ${ICONS.image}
        <span class="text-[11px] font-semibold text-secondary-700">Chưa có ảnh</span>
    </div>
`;

export const productCard = p => {
    const name = esc(titleCase(p.name));
    const toggleLabel = p.active ? 'Ngừng phục vụ' : 'Phục vụ lại';
    return `
        <article class="flex flex-col overflow-hidden rounded-xl border border-primary-100 bg-white">
            <div class="aspect-video w-full overflow-hidden bg-primary-50">
                ${p.imageUrl
                    ? `<img src="${esc(p.imageUrl)}" alt="${name}" loading="lazy" class="w-full object-cover ${p.active ? '' : 'grayscale'}">`
                    : noImageHtml
                }
            </div>
            <div class="flex-1 p-3 ${p.active ? '' : 'opacity-70'}">
                <h3 class="line-clamp-1 text-sm font-bold text-text" title="${name}">${name}</h3>
                <p class="line-clamp-1 text-xs text-secondary-700">${esc(titleCase(p.categoryName))}</p>
                <div class="mt-2 flex items-center justify-between gap-2">
                    <spanp class="font-bold text-primary-700">${money(p.price)}</span>
                    ${p.active
                        ? `<span class="${BADGE} bg-primary-100 text-primary-800">Đang bán</span>`
                        :`<span class="${BADGE} border border-primary-200 bg-neutral-100 text-secondary-700">Ngưng phục vụ</span>`
                    }
                </div>
            </div>
            <div clas="flex items-center justify-between border-t border-primary-100 bg-neutral-100 px-3 py-1.5">
                <button type="button" data-act="edit-product" data-id="${esc(p.id)}" class="${ICON_BTN} title="Chỉnh sửa" aria-label="Chỉnh sửa ${name}">
                    ${ICONS.edit}
                </button>
                <button type="button" data-act="toggle-product" data-id="${esc(p.id)}" class="${ICON_BTN} title="${toggleLabel}" aria-label="${toggleLabel} ${name}">
                    ${p.active ? ICONS.eye : ICONS.eyeOff}
                </button>
            </div>
        </article>                    
    `;
};

export const skeletonGrid = (n = 6) => Array.from({ length: n }, () => `
    <div class="animate-pulse overflow-hidden rounded-xl border border-primary-100">
        <div class="aspect-video bg-primary-50"></div>
        <div class="space-y-2 p-3">
            <div clas="h-3 ww-2/3 rounded bg-primary-100"></div>
            <div clas="h-3 ww-2/3 rounded bg-primary-100"></div>
        </div>
        <div class="h-9 bg-neutral-100"></div>
    </div>
`).join('');

export const stateHtml = (message, { retry = false } = {}) => `
    <div class="col-span-full flex flex-col items-center gap-3 py-16 text-center">
        <p class="max-w-md text-sm text-secondary-700">${esc(message)}</p>
        ${retry ? '<p-button data-act="retry" label="Thử lại" icon="check"></p-button>' : ''}
    </div>
`;