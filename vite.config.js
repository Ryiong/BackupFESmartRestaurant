import { defineConfig } from 'vite';

export default defineConfig({
    root: 'src',
    server: {
        port: 5173,
        open: '/main/resources/templates/auth/login.html'
    }
});