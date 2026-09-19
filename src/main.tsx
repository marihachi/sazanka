import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 共通のスタイルを、各コンポーネントのスタイルより先に読み込む
import './styles/style.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
