import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    server: {
        host: true,
        port: 5173,
        allowedHosts: true,
        open: '/main/resources/templates/auth/login.html',
        proxy: {
            '/smart-restaurant': {
                target: 'http://localhost:8080',
                changeOrigin: true,
                configure: proxy => {
                    proxy.on('proxyReq', req => {
                        req.removeHeader('origin');
                    });
                },
            },
        },
    },
});