/* eslint-disable react-refresh/only-export-components -- main.tsx is the app entry point; it intentionally has no exports */
import React from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  return <div>Stellar Save - Coming Soon</div>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
