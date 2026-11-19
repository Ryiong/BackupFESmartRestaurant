// Nạp thư viện bản đồ Leaflet (ô bản đồ OpenStreetMap) một lần duy nhất khi cần.
const BASE = 'https://unpkg.com/leaflet@1.9.4/dist';
let loading = null;

export function loadLeaflet() {
    if (window.L?.map) return Promise.resolve(window.L);
    loading ??= new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet'; css.href = `${BASE}/leaflet.css`;
        const js = document.createElement('script');
        js.src = `${BASE}/leaflet.js`; js.async = true;
        js.onload = () => resolve(window.L);
        js.onerror = () => { loading = null; css.remove(); js.remove(); reject(new Error('Không tải được thư viện bản đồ')); };
        document.head.append(css, js);
    });
    return loading;
}
