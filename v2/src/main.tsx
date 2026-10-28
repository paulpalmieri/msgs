import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { run } from './db/duckdb';
import './index.css';

// Dev only: query the in-page database from the console, e.g. await __msgs.run('SELECT 1').
if (import.meta.env.DEV) Object.assign(window, { __msgs: { run } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
