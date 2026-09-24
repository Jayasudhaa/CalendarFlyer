/**
 * src/components/GoogleLoginButton.jsx
 * Renders the Google Sign-In button using @react-oauth/google.
 *
 * Google's button is a fixed-pixel-width iframe (no percentage widths), so
 * a hardcoded width either overflows a narrow phone screen or leaves a gap
 * on a wide card. This measures its own container with ResizeObserver and
 * asks Google to render at that width instead — accurate on first paint
 * and whenever the container is resized.
 */
import React, { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

function GoogleLoginButton({ onSuccess, onError, theme = 'outline' }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(Math.min(400, Math.max(220, Math.floor(el.offsetWidth))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
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
        theme={theme}
        size="large"
        text="signin_with"
        shape="rectangular"
        logo_alignment="left"
        width={width}
      />
    </div>
  );
}

export default GoogleLoginButton;
