import { createAreaService, seedAreas } from './AreaService.mock.js';
import { mockApi, mockApiList } from './MockAPIClient.js';
import { mockApiSales } from './RevenueService.mockapi.js';

const RES = '/areas';
const SEEDED_KEY = 'sr:mockapi:seeded';

const isArea = a => a && typeof a.name === 'string' && Array.isArray(a.tables);
const wasSeeded = () => { try { return localStorage.getItem(SEEDED_KEY) === '1'; } catch { return false; } };
const markSeeded = () => { try { localStorage.setItem(SEEDED_KEY, '1'); } catch { /* noop */ } };

const normalize = a => ({ ...a, id: String(a.id) });

let seeding = null;

async function loadAreas() {
    const rows = (await mockApiList(RES)).filter(isArea);
    if (rows.length || wasSeeded()) return rows.map(normalize);

    seeding ??= (async () => {
        const created = [];
        for (const a of seedAreas()) {
            const { id, ...body } = a;
            created.push(normalize(await mockApi('POST', RES, { body })));
        }
        markSeeded();
        return created;
    })().finally(() => { seeding = null; });
    return seeding;
}

const mockApiAreaDriver = {
    load: loadAreas,

    async save(db, before) {
        const prev = new Map(before.map(a => [a.id, JSON.stringify(a)]));
        const now = new Set(db.map(a => a.id));
        const jobs = [];

        for (const a of before) {
            if (!now.has(a.id)) jobs.push(mockApi('DELETE', `${RES}/${a.id}`));
        }
        for (const a of db) {
            const { id, ...body } = a;
            if (!prev.has(id)) {
                jobs.push(mockApi('POST', RES, { body }).then(row => { a.id = String(row.id); }));
            } else if (prev.get(id) !== JSON.stringify(a)) {
                jobs.push(mockApi('PUT', `${RES}/${id}`, { body }));
            }
        }
        await Promise.all(jobs);
    },
};

export const mockAPIAreaService = createAreaService({
    driver: mockApiAreaDriver,
    recordSale: sale => mockApiSales.record(sale),
});
