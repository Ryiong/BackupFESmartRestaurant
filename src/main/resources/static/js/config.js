/**
 * 'local': dữ liệu giả lập localStorage
 * 'mockapi': dữ liệu thử nghiệm mockapi.com
 * 'spring': gọi backend Spring Boot thật qua SPRING_BASE tham khảo tài liệu document
 */
export const API_MODE = 'spring';

export const SPRING_BASE = 'http://localhost:8080/smart-restaurant/v1';
export const BASE_URL = '/main/resources/templates';
export const LOGIN_URL = `${BASE_URL}/auth/login.html`;
export const REGISTER_URL = `${BASE_URL}/auth/register.html`;
export const ADMIN_URL = `${BASE_URL}/admin/index.html`;