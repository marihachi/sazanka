import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/app.js';
import './index.css';
import { initStage } from './app/stage.js';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

initStage();
