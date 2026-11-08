export const API_MODE = 'spring';

export const SPRING_BASE = 'http://localhost:8080/smart-restaurant/v1';
export const BASE_URL = '/main/resources/templates';
export const LOGIN_URL = `${BASE_URL}/auth/login.html`;
export const REGISTER_URL = `${BASE_URL}/auth/register.html`;
export const ADMIN_URL = `${BASE_URL}/admin/index.html`;
export const STAFF_ATTENDANCE_URL = `${BASE_URL}/staff/attendance.html`;

/**
 * Đây là setting cho khách quét để đặt món
 * CUSTOMER_BASE_URL: '' thì dùng cho localhost; khi chạy thật thì đổi sang domain thật
 */

export const CUSTOMER_BASE_URL = '';
export const CUSTOMER_ORDER_PATH = `${BASE_URL}/customer/order.html`;

/**
 * Địa chỉ gốc để dựng link trong các mã QR của nhân viên (QR chấm công, QR đăng nhập thiết bị khác).
 * '' thì dùng địa chỉ trang đang mở; khi chạy thật thì đổi sang domain thật.
 * Lưu ý: điện thoại chỉ mở được camera/GPS khi trang chạy bằng HTTPS (hoặc localhost).
 */
export const STAFF_BASE_URL = '';