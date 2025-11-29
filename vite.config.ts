import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/onnxruntime-web/dist/ort.min.js',
            dest: '.'
          },
          {
            src: 'node_modules/@ricky0123/vad-web/dist/bundle.min.js',
            dest: '.',
            rename: 'vad.bundle.min.js'
          },
          {
            src: 'node_modules/onnxruntime-web/dist/*.wasm',
            dest: '.'
          },
          {
            src: 'node_modules/onnxruntime-web/dist/*.mjs',
            dest: '.'
          },
          {
            src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
            dest: '.'
          },
          {
            src: 'node_modules/@ricky0123/vad-web/dist/*.onnx',
            dest: '.'
          },
        ]
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
