import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  css: {
    // CSS ではケバブケース、TS では styles.pinLabel のようにキャメルケースで参照する
    modules: { localsConvention: 'camelCaseOnly' },
  },
});
