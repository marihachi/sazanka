import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/app.js';
import './index.css';
import { initStage } from './app/stage.js';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

initStage();
