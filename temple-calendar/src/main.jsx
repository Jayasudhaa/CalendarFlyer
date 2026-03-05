import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google'; // Import this
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Replace with your actual Client ID from Google Cloud Console */}
    <GoogleOAuthProvider clientId="222197933595-201pgkmptsjb355grv4hrik8en2fin16.apps.googleusercontent.com">
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);