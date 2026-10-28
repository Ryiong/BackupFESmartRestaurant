import { API_MODE } from '../config.js';
import { httpAll } from './HttpClient.js';
import { getShopId } from './ShopService.js';
import { areaService } from './AreaService.js';


export async function getTableStats() {
    const areas = await areaService.listAreas();
    const active = areas.filter(a => a.active);
    const tables = active.flatMap(a => a.tables);
    const busy = tables.filter(t => t.status !== 'empty').length;
    return { total: tables.length, busy, empty: tables.length - busy, pausedAreas: areas.length - active.length };
}

export async function getProductStats() {
    if (API_MODE !== 'spring') {
        const menu = await areaService.listMenu();
        return { active: menu.length, total: menu.length };
    }
    const shopId = await getShopId();
    const cats = await httpAll(`/category/shop/${shopId}`);
    const lists = await Promise.all(cats.map(c => httpAll(`/product/category/${c.id}`)));
    const all = lists.flat();
    return { active: all.filter(p => p.status === 'ACTIVE').length, total: all.length };
}
