import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App'  // ← FIXED: Changed from PremiumApp to App
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId="local-test-disabled">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);