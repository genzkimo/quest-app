import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safety patch for window.confirm in iframe environments to prevent uncaught security DOMExceptions
try {
  const nativeConfirm = window.confirm;
  window.confirm = (message?: string) => {
    try {
      return nativeConfirm(message);
    } catch (e) {
      console.warn("window.confirm was blocked by iframe/sandbox security, auto-resolving to true:", e);
      return true; // Safe auto-approval fallback for development frames to prevent "Script error." crashes
    }
  };
} catch (patchErr) {
  console.warn("Could not patch window.confirm wrapper:", patchErr);
}

// Register PWA service worker for Chrome and other compatible browsers with a safety check for iframes and exceptions
try {
  const isIframe = window.self !== window.top;
  if (!isIframe && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      try {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('Quest Service Worker registered successfully:', reg.scope);
          })
          .catch((err) => {
            console.warn('Quest Service Worker registration failed (promise reject):', err);
          });
      } catch (innerErr) {
        console.warn('Quest Service Worker registration failed (inner catch):', innerErr);
      }
    });
  }
} catch (outerErr) {
  console.warn('Quest Service Worker check failed (outer catch):', outerErr);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
