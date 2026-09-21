/// <reference types="vite/client" />

/** アプリに同梱しているライブラリのライセンス。ビルド時に vite.config.ts で node_modules から集める */
declare module 'virtual:licenses' {
  const licenses: { name: string; version: string; license: string; text: string }[];
  export default licenses;
}
