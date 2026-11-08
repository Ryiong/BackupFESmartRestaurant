import qrcode from './qrcode.js';

export function qrSvg(text, { level = 'M', quiet = 3 } = {}) {
    const qr = qrcode(0, level);
    qr.addData(text, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    const size = n + quiet * 2;
    let d = '';
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            if (qr.isDark(r, c)) {
                d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
            }
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Mã QR">`
        + `<rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}