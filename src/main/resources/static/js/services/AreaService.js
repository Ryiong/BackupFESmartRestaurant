import { API_MODE } from '../config.js';
import { springAreaService } from './AreaService.spring.js';

export const USE_MOCK = API_MODE !== 'spring';

const SERVICES = {
    spring: springAreaService
};

if (!(API_MODE in SERVICES)) {
    throw new Error(`API_MODE "${API_MODE}" không hợp lệ - chọn 'spring' trong config.js`);
}

export const areaService = SERVICES[API_MODE];