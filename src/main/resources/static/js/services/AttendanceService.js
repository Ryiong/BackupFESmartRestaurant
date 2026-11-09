// Chấm công phía nhân viên: dựng/đọc QR chấm công, tìm ca của mình, lấy vị trí và gọi API chấm công.
import { http } from './HttpClient.js';
import { auth } from './AuthStore.js';
import { STAFF_ATTENDANCE_URL } from '../config.js';
import { publicUrl } from './Session.js';
import { ymd, addDays, parseYmd, hm } from './HrService.js';

/** Backend cho chấm công từ 30 phút trước ca đến 30 phút sau ca. */
export const WINDOW_MIN = 30;

/** Máy chủ từ chối vì tài khoản không có quyền xem mục này: giao diện hiển thị "không có nội dung" thay vì báo lỗi. */
export class NoAccessError extends Error {
    constructor() { super('Không có nội dung'); this.noAccess = true; }
}

const pad = n => String(n).padStart(2, '0');
/** Giờ địa phương dạng ISO không múi giờ (khớp LocalDateTime của backend). */
export const localIso = d =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/* ---------- QR chấm công ---------- */

/**
 * Nội dung QR chấm công do màn hình quản lý hiển thị tại quán.
 * Backend hiện nhận `qrExpiredAt` do thiết bị gửi lên nên QR phải đổi liên tục (hạn ngắn) mới có ý nghĩa.
 */
export function buildAttendanceQr(shopId, ttlSeconds = 60) {
    const exp = new Date(Date.now() + ttlSeconds * 1000);
    const url = `${publicUrl(STAFF_ATTENDANCE_URL)}?shop=${encodeURIComponent(shopId)}&exp=${encodeURIComponent(localIso(exp))}`;
    return { url, exp };
}

/** Đọc nội dung QR chấm công -> { shopId, exp }. Ném Error nếu không phải QR chấm công. */
export function parseAttendanceQr(text) {
    let u;
    try { u = new URL(String(text).trim()); } catch { throw new Error('Đây không phải mã QR chấm công.'); }
    if (!u.pathname.endsWith('/staff/attendance.html')) throw new Error('Đây không phải mã QR chấm công.');
    const shopId = Number(u.searchParams.get('shop'));
    const exp = u.searchParams.get('exp');
    if (!Number.isInteger(shopId) || shopId <= 0 || !exp || Number.isNaN(Date.parse(exp))) {
        throw new Error('Mã QR chấm công không hợp lệ.');
    }
    return { shopId, exp };
}

/* ---------- Ca làm của chính mình ---------- */

const toMin = t => { const [h, m] = hm(t).split(':').map(Number); return h * 60 + m; };

/** Mốc thời gian (ms) của một ca: giờ bắt đầu/kết thúc và khung được phép chấm công. Ca qua đêm thì kết thúc sang ngày sau. */
export function shiftWindow({ date, startTime, endTime }) {
    const base = parseYmd(date).getTime();
    const start = base + toMin(startTime) * 60000;
    let end = base + toMin(endTime) * 60000;
    if (end <= start) end += 86400000;
    return { start, end, opens: start - WINDOW_MIN * 60000, closes: end + WINDOW_MIN * 60000 };
}

const sameUser = (employment, me) => {
    const a = String(employment?.user?.email ?? '').toLowerCase();
    return Boolean(a) && a === String(me ?? '').toLowerCase();
};

const mapShift = w => {
    const s = {
        id: w.id,
        date: w.date,
        shiftName: w.shift?.name ?? 'Ca làm',
        startTime: hm(w.shift?.startTime),
        endTime: hm(w.shift?.endTime),
        attendances: (w.attendances ?? []).map(a => ({ type: a.type, at: a.createdAt })),
    };
    return { ...s, ...shiftWindow(s) };
};

/**
 * Các ca của người đang đăng nhập tại cửa hàng `shopId` trong hôm nay (và đêm qua, cho ca qua đêm).
 * Backend chỉ có API xem lịch cả cửa hàng nên lọc theo email của mình ở đây;
 * vai trò của nhân viên cần quyền xem lịch làm việc.
 */
export async function listMyShifts(shopId) {
    const today = ymd();
    let days;
    try {
        days = await Promise.all([addDays(today, -1), today].map(date =>
            http('GET', `/work-schedule/${shopId}`, undefined, { query: { date } })));
    } catch (err) {
        if (err.status === 403) throw new NoAccessError();
        throw err;
    }
    const me = auth.user?.email;
    return days.flat()
        .filter(w => w && (w.status ?? 'SCHEDULED') === 'SCHEDULED' && sameUser(w.employmentResponse ?? w.employment, me))
        .map(mapShift)
        .filter(s => s.date === today || s.closes > Date.now())
        .sort((a, b) => a.start - b.start);
}

/** Các ca đang trong khung giờ cho phép chấm công và chưa chấm đủ vào/ra. */
export const eligibleShifts = (shifts, now = Date.now()) =>
    shifts.filter(s => now >= s.opens && now <= s.closes && s.attendances.length < 2);

/* ---------- Vị trí & gọi API ---------- */

export function getPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Thiết bị không hỗ trợ định vị.'));
        if (!window.isSecureContext) return reject(new Error('Cần mở trang bằng HTTPS để lấy vị trí chấm công.'));
        navigator.geolocation.getCurrentPosition(
            p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
            e => reject(new Error(
                e.code === 1 ? 'Bạn cần cho phép truy cập vị trí để chấm công.'
                    : e.code === 3 ? 'Không xác định được vị trí, hãy bật GPS và thử lại.'
                        : 'Không lấy được vị trí hiện tại, hãy bật GPS và thử lại.')),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
        );
    });
}

/** POST /attendance/check-attendance. Backend tự quyết định đây là lượt vào hay ra. */
export const checkAttendance = ({ shopId, workScheduleId, qrExpiredAt, latitude, longitude }) =>
    http('POST', '/attendance/check-attendance', { shopId, workScheduleId, qrExpiredAt, latitude, longitude });
