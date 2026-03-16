import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import './i18n';
import { AppProviders } from './providers/AppProviders';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
