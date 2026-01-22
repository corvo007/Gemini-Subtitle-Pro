import * as Sentry from '@sentry/electron/renderer';
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './i18n'; // Initialize i18n
import App from '@/App';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

// Initialize Sentry for error tracking in Renderer process
Sentry.init();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root mount element not found');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
