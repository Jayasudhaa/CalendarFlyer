/**
 * src/components/GoogleLoginButton.jsx
 * Renders the Google Sign-In button using @react-oauth/google
 */
import React from 'react';
import { GoogleLogin } from '@react-oauth/google';

const GoogleLoginButton = ({ onSuccess, onError }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <GoogleLogin
        onSuccess={(credentialResponse) => {
          if (credentialResponse.credential) {
            onSuccess(credentialResponse.credential);
          } else {
            onError('No credential returned from Google');
          }
        }}
        onError={() => onError('Google Sign-In failed')}
        useOneTap={false}
        theme="outline"
        size="large"
        text="signin_with"
        shape="rectangular"
        logo_alignment="left"
        width="320"
      />
    </div>
  );
};

export default GoogleLoginButton;
