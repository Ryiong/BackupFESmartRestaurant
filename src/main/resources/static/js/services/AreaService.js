import { API_MODE } from '../config.js';
import { springAreaService } from './AreaService.spring.js';
import { mockAreaService } from './AreaService.mock.js';
import { mockAPIAreaService } from './AreaService.mockapi.js';

export const USE_MOCK = API_MODE !== 'spring';

const SERVICES = {
    local: mockAreaService,
    mockapi: mockAPIAreaService,
    spring: springAreaService
};

if (!(API_MODE in SERVICES)) {
    throw new Error(`API_MODE "${API_MODE}" không hợp lệ - chọn 'local', 'mockapi' hoặc 'spring' trong config.js`);
}

export const areaService = SERVICES[API_MODE];