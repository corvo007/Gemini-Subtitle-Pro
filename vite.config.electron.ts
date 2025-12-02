import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    build: {
        ssr: true,
        sourcemap: 'inline',
        outDir: 'dist-electron',
        emptyOutDir: true,
        lib: {
            entry: {
                main: path.resolve(__dirname, 'electron/main.ts'),
                preload: path.resolve(__dirname, 'electron/preload.ts'),
            },
            formats: ['cjs'],
        },
        rollupOptions: {
            external: ['electron', 'path', 'fs', 'os', 'child_process'],
            output: {
                entryFileNames: '[name].cjs',
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    define: {
        'process.env.DEBUG_BUILD': JSON.stringify(process.env.DEBUG_BUILD || 'false'),
    },
});
