import { ChakraProvider } from '@chakra-ui/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// 共通のスタイルを、各コンポーネントのスタイルより先に読み込む
import './style.css';
import { App } from './app/App';
import { system } from './components/theme';

const root = document.getElementById('root');
if (!root) {
  throw new Error('index.html に #root がありません');
}

createRoot(root).render(
  <StrictMode>
    <ChakraProvider value={system}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
