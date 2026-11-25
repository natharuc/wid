import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { WorkContextProvider } from './WorkContext';
import './framework.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkContextProvider>
      <App />
    </WorkContextProvider>
  </React.StrictMode>,
);
