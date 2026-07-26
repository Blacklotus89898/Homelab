import '@backstage/cli/asset-types';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@backstage/ui/css/styles.css';

// crypto.randomUUID is only available in secure contexts (HTTPS/localhost).
// Polyfill it for plain-HTTP deployments using getRandomValues, which is available everywhere.
if (
  typeof globalThis.crypto !== 'undefined' &&
  typeof globalThis.crypto.randomUUID !== 'function'
) {
  (globalThis.crypto as any).randomUUID = function randomUUID(): string {
    return (([1e7] as any) + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      (c: any) =>
        (
          c ^
          (globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
        ).toString(16),
    );
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(App.createRoot());
