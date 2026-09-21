import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages では https://<ユーザー名>.github.io/sazanka/ に置かれるので、その位置から読めるようにする
  base: '/sazanka/',
  plugins: [react()],
  css: {
    // CSS ではケバブケース、TS では styles.pinLabel のようにキャメルケースで参照する
    modules: { localsConvention: 'camelCaseOnly' },
  },
});
