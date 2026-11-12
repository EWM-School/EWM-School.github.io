import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isNativeMobile } from './services/platform/platformInfo';

createRoot(document.getElementById('root')!).render(<App />);

if (!isNativeMobile() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).catch(() => {
      // Ignore registration restrictions in sandboxed preview contexts
    });
  });
}
