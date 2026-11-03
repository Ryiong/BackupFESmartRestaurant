import * as cfg from '../config.js';
import { http } from './HttpClient.js';
import { getShopId } from './ShopService.js';

export const GRACE_MIN = 5; //chấm công sau 5 phút mới tính à trễ giờ

const P = (...a) => a.map(x => `PERM_${x}`);
export const PERM_MATRIX = [
    {
        key: 'order',
        label: 'Quản lý đơn hàng',
        view: P('ORDER_VIEW'),
        create: P('ORDER_CREATE'),
        update: [],
        delete: P('ORDER_ITEM_DELETE'),
        other: P('ORDER_PAYMENT', 'ORDER_TABLE_MERGE', 'ORDER_TABLE_MOVE')
    },
    {
        key: 'area',
        label: 'Sơ đồ bàn & Khu vực',
        view: P('AREA_VIEW', 'TABLE_VIEW'),
        create: P('AREA_CREATE', 'TABLE_CREATE'),
        update: P('AREA_UPDATE', 'TABLE_UPDATE'),
        delete: P('AREA_DELETE', 'TABLE_DELETE'),
        other: P('AREA_ACTIVATE', 'TABLE_ACTIVATE')
    },
    {
        key: 'menu',
        label: 'Thực đơn món ăn',
        view: P('CATEGORY_VIEW', 'PRODUCT_VIEW', 'RECIPE_INGREDIENT_VIEW'),
        create: P('CATEGORY_CREATE', 'PRODUCT_CREATE', 'RECIPE_INGREDIENT_CREATE'),
        update: P('CATEGORY_UPDATE', 'PRODUCT_UPDATE', 'RECIPE_INGREDIENT_UPDATE'),
        delete: P('CATEGORY_DELETE', 'PRODUCT_DELETE', 'RECIPE_INGREDIENT_DELETE'),
        other: P('CATEGORY_ACTIVATE', 'PRODUCT_ACTIVATE')
    },
    {
        key: 'stock',
        label: 'Quản lý kho hàng',
        view: P('INGREDIENT_VIEW', 'INVENTORY_VIEW'),
        create: P('INGREDIENT_CREATE', 'INVENTORY_CREATE'),
        update: P('INGREDIENT_UPDATE'),
        delete: P('INGREDIENT_DELETE'),
        other: P('INGREDIENT_ACTIVATE', 'INVENTORY_APPROVE', 'INVENTORY_REJECT')
    },
    {
        key: 'hr',
        label: 'Nhân viên',
        view: P('EMPLOYMENT_VIEW'),
        create: P('EMPLOYMENT_CREATE'),
        update: P('EMPLOYMENT_UPDATE'),
        delete: P('EMPLOYMENT_TERMINATE'),
        other: []
    },
    {
        key: 'shift',
        label: 'Ca làm & Lịch',
        view: P('SHIFT_VIEW', 'WORK_SCHEDULE_VIEW'),
        create: P('SHIFT_CREATE', 'WORK_SCHEDULE_CREATE'),
        update: P('SHIFT_UPDATE', 'WORK_SCHEDULE_UPDATE'),
        delete: P('SHIFT_DELETE', 'WORK_SCHEDULE_DELETE'),
        other: P('SHIFT_ACTIVATE')
    },
    {
        key: 'shop',
        label: 'Cửa hàng & Thiết bị',
        view: [],
        create: [],
        update: [],
        delete: [],
        other: P('SHOP_SET_LOCATION', 'HOST_DEVICE_REGISTER')
    },
];

export const PERM_LABEL = {
    PERM_ORDER_PAYMENT: 'Thanh toán',
    PERM_ORDER_TABLE_MERGE: 'Gộp bàn',
    PERM_ORDER_TABLE_MOVE: 'Chuyển bàn',
    PERM_AREA_ACTIVATE: 'Bật lại khu vực',
    PERM_TABLE_ACTIVATE: 'Bật lại bàn',
    PERM_CATEGORY_ACTIVATE: 'Bật lại danh mục',
    PERM_PRODUCT_ACTIVATE: 'Bật lại món',
    PERM_INGREDIENT_ACTIVATE: 'Bật lại nguyên liệu',
    PERM_INVENTORY_APPROVE: 'Duyệt phiếu kho',
    PERM_INVENTORY_REJECT: 'Từ chối phiếu kho',
    PERM_SHIFT_ACTIVATE: 'Bật lại ca kíp',
    PERM_SHOP_SET_LOCATION: 'Đặt vị trí cửa hàng',
    PERM_HOST_DEVICE_REGISTER: 'Đăng ký máy POS',
};

const pad = n => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseYmd = s => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const addDays = (s, n) => {
    const d = parseYmd(s);
    d.setDate(d.getDate() + n);
    return ymd(d);
};

export const hm = t => String(t ?? '').slice(0, 5);

const toMin = t => { const [h, m] = hm(t).split(':').map(Number); return h * 60 + m; };
export const shiftMinutes = s => {
    const d = toMin(s.endTime) - toMin(s.startTime);
    return d > 0 ? d : d + 1440;
};

export const isOvernight = s => toMin(s.endTime) <= toMin(s.startTime);

export const cap = s => (s ?? '').replace(/(^|\s)\S/g, c => c.toUpperCase());

const slotMs = (date, shift) => {
    const base = parseYmd(date).getTime();
    const start = base + toMin(shift.startTime) * 60000;
    return { start, end: start + shiftMinutes(shift) * 60000 };
};

export function attState(s, now = Date.now()) {
    const { start, end } = slotMs(s.date, s);
    const inn = s.attendances.find(a => a.type === 'CHECK_IN');
    const out = s.attendances.find(a => a.type === 'CHECK_OUT');
    const late = inn ? new Date(inn.at).getTime() - start > GRACE_MIN * 60000 : false;
    if (out) return {
        code: 'DONE',
        late,
        inAt: inn?.at,
        outAt: out.at
    };

    if (inn) return {
        code: late ? 'LATE' : 'ONTIME',
        late, inAt: inn.at
    };

    return { code: now > end ? 'ABSENT' : 'WAIT', late: false };
}

export const workedHours = s => {
    const inn = s.attendances.find(a => a.type === 'CHECK_IN');
    const out = s.attendances.find(a => a.type === 'CHECK_OUT');
    return inn && out ? Math.max(0, Math.round((new Date(out.at) - new Date(inn.at)) / 36e5 * 100) / 100) : 0;
};

export const HR_MODE = cfg.API_MODE;

const pageList = r => Array.isArray(r) ? r : (r?.content ?? []);

// Backend chưa có GET employment -> danh sách nhân viên được giữ ở localStorage, theo từng shop.
const staffKey = sid => `sr:staff-cache:${sid}`;
const readCache = sid => {
    try { return JSON.parse(localStorage.getItem(staffKey(sid)) ?? '[]'); } catch { return []; }
};
const writeCache = (sid, list) => {
    try { localStorage.setItem(staffKey(sid), JSON.stringify(list)); } catch { }
};

/** Chạy fn trên từng phần tử với tối đa `limit` request song song (tránh bắn 31 request cùng lúc khi xem cả tháng). */
const pool = async (items, fn, limit = 5) => {
    const out = new Array(items.length);
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (i < items.length) {
            const k = i++;
            out[k] = await fn(items[k]);
        }
    }));
    return out;
};

// Nhiều panel cùng gọi listRoles trong một lần tải -> dùng chung một request trong vài giây.
const ROLE_TTL = 3000;
let rolesMemo = null;

// Backend duyệt công theo employmentId nên cần nhớ employmentId của từng lịch vừa tải.
const scheduleIndex = new Map();

const mapEmployment = (e, extra = {}) => ({
    id: e.id,
    name: e.user?.name ?? extra.name ?? '',
    email: e.user?.email ?? extra.email ?? '',
    phoneNumber: e.user?.phoneNumber ?? extra.phoneNumber ?? '',
    salary: Number(e.salary),
    workFrom: e.workFrom,
    endedAt: e.endedAt ?? null,
    status: e.status,
    roleIds: extra.roleIds ?? [],
    roleNames: extra.roleNames ?? [],
});

const mapSchedule = (w, staffById) => {
    const e = w.employmentResponse ?? w.employment ?? {};
    const c = staffById.get(e.id) ?? {};
    return {
        id: w.id,
        date: w.date,
        status: w.status ?? 'SCHEDULED',
        attendanceStatus: w.attendanceStatus ?? 'PENDING',
        rejectReason: null,
        explanation: null,
        employmentId: e.id,
        staffName: e.user?.name ?? c.name ?? `NV #${e.id}`,
        roleNames: c.roleNames ?? [],
        shiftId: w.shift?.id,
        shiftName: w.shift?.name ?? '',
        startTime: hm(w.shift?.startTime),
        endTime: hm(w.shift?.endTime),
        attendances: (w.attendances ?? []).map(a => ({ type: a.type, at: a.createdAt })),
    };
};

const mapShift = s => ({
    id: s.id,
    name: s.name,
    startTime: hm(s.startTime),
    endTime: hm(s.endTime),
    status: s.status,
});

const mapRole = r => ({
    id: r.id,
    name: r.name,
    status: 'ACTIVE',
    permissionIds: (r.permissions ?? []).map(p => p.id),
});

const roleNamesOf = (roles, ids) => ids.map(i => roles.find(r => r.id === i)?.name).filter(Boolean);

export const hr = {
    listPermissions() {
        return http('GET', '/permissions');
    },

    async listRoles() {
        const sid = await getShopId();
        if (rolesMemo && rolesMemo.sid === sid && Date.now() - rolesMemo.at < ROLE_TTL) return rolesMemo.p;
        const p = http('GET', `/role/roles/${sid}`, undefined, { query: { status: 'ACTIVE', size: 100 } })
            .then(r => pageList(r).map(mapRole));
        const memo = rolesMemo = { sid, at: Date.now(), p };
        p.catch(() => { if (rolesMemo === memo) rolesMemo = null; });
        return p;
    },

    async saveRole({ id, name, permissionIds }) {
        // Backend chỉ chuẩn hoá tên (trim + lowercase) lúc tạo, không làm khi cập nhật -> tự chuẩn hoá để đồng nhất.
        const body = { name: name.trim().toLowerCase(), permissionIds };
        const sid = await getShopId();
        const r = id ? await http('PUT', `/role/${id}`, body) : await http('POST', `/role/${sid}`, body);
        rolesMemo = null;
        return mapRole(r);
    },

    async deleteRole(id) {
        await http('DELETE', `/role/${id}`);
        rolesMemo = null;
    },

    /** Nhân viên lấy từ cache trình duyệt; tên vai trò được đối chiếu lại với danh sách vai trò hiện tại. */
    async listStaff() {
        const sid = await getShopId();
        const cache = readCache(sid);
        const roles = await this.listRoles().catch(() => null);
        if (!roles) return cache;
        return cache.map(s => {
            const roleIds = (s.roleIds ?? []).filter(id => roles.some(r => r.id === id));
            return { ...s, roleIds, roleNames: roleNamesOf(roles, roleIds) };
        });
    },

    async createStaff({ name, email, phoneNumber, password, salary, workFrom, roleIds }) {
        const sid = await getShopId();
        const e = await http('POST', `/employment/${sid}`, {
            registerRequest: { name, email, phoneNumber, password },
            salary,
            workFrom,
            roleIds,
        });
        // Tài khoản đã được tạo ở backend: dù tra tên vai trò lỗi vẫn phải lưu vào cache, nếu không nhân viên "mất tích".
        const roles = await this.listRoles().catch(() => []);
        const st = mapEmployment(e, { name, email, phoneNumber, roleIds, roleNames: roleNamesOf(roles, roleIds) });
        writeCache(sid, [...readCache(sid).filter(s => s.id !== st.id), st]);
        return st;
    },

    async updateStaff(id, { salary, roleIds }) {
        const sid = await getShopId();
        const e = await http('PUT', `/employment/${id}`, { salary, roleIds });
        const roles = await this.listRoles().catch(() => []);
        const list = readCache(sid).map(s => s.id === id
            ? { ...s, salary: Number(e?.salary ?? salary), roleIds, roleNames: roleNamesOf(roles, roleIds) }
            : s);
        writeCache(sid, list);
        return list.find(s => s.id === id);
    },

    async terminateStaff(id) {
        const sid = await getShopId();
        await http('DELETE', `/employment/${id}`);
        writeCache(sid, readCache(sid).map(s => s.id === id ? { ...s, status: 'TERMINATED', endedAt: ymd() } : s));
    },

    async listShifts() {
        const sid = await getShopId();
        return pageList(await http('GET', `/shift/shop/${sid}`, undefined, { query: { size: 100 } })).map(mapShift);
    },

    async saveShift({ id, name, startTime, endTime }) {
        const body = { name, startTime: hm(startTime), endTime: hm(endTime) };
        const sid = await getShopId();
        return mapShift(id ? await http('PUT', `/shift/${id}`, body) : await http('POST', `/shift/${sid}`, body));
    },

    async deleteShift(id) { await http('DELETE', `/shift/${id}`); },

    async activateShift(id) { await http('PATCH', `/shift/${id}/activate`); },

    async listSchedule(date) {
        const sid = await getShopId();
        const staffById = new Map(readCache(sid).map(s => [s.id, s]));
        const r = await http('GET', `/work-schedule/${sid}`, undefined, { query: { date } });
        const list = [...(r ?? [])]
            .filter(w => (w.status ?? 'SCHEDULED') === 'SCHEDULED')
            .map(w => mapSchedule(w, staffById));
        list.forEach(s => scheduleIndex.set(s.id, s));
        return list;
    },

    async listScheduleRange(from, to) {
        const days = [];
        for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
        return (await pool(days, d => this.listSchedule(d))).flat();
    },

    async assign(date, items) {
        const sid = await getShopId();
        await http('POST', `/work-schedule/${sid}`,
            items.map(({ shiftId, employmentId }) => ({ shiftId, employmentId })), { query: { date } });
    },

    async changeShift(id, shiftId) {
        const sid = await getShopId();
        await http('PATCH', `/work-schedule/${sid}`, { shiftId }, { query: { workScheduleId: id } });
    },

    async cancelSchedule(id) { await http('DELETE', `/work-schedule/${id}`); },

    async reviewAttendance(id, status, rejectReason) {
        const sch = scheduleIndex.get(id);
        if (!sch) throw new Error('Hãy tải lại danh sách rồi thử lại');
        const sid = await getShopId();
        await http('POST', `/work-schedule/${sid}/update-attendance-status/${sch.employmentId}`, [{ id, status, rejectReason }]);
    },
};
