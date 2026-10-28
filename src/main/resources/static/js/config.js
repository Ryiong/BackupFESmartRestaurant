/**
 * 'local': dữ liệu giả lập localStorage
 * 'mockapi': dữ liệu thử nghiệm mockapi.com
 * 'spring': gọi backend Spring Boot thật qua SPRING_BASE tham khảo tài liệu document
 */
export const API_MODE = 'spring';

export const MOCKAPI_BASE = 'https://6ae07898be3bc8fead974ed8.mockapi.io/';

export const SPRING_BASE = 'http://localhost:8080/smart-restaurant/v1';
export const LOGIN_URL = '/src/main/resources/templates/auth/login.html';
export const REGISTER_URL = '/src/main/resources/templates/auth/register.html';
export const ADMIN_URL = '/src/main/resources/templates/admin/index.html';