// Fabric v6 UMD build via cdnjs
import { useState, useEffect } from 'react';
const FABRIC_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';

let loaded = false;
let loading = false;
const callbacks = [];

export const useFabric = () => {
  const [ready, setReady] = useState(
    typeof window !== 'undefined' && !!window.fabric
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.fabric) { setReady(true); return; }
    if (loaded) { setReady(true); return; }

    callbacks.push(() => setReady(true));

    if (!loading) {
      loading = true;
      const script = document.createElement('script');
      script.src = FABRIC_CDN;
      script.async = true;
      script.onload = () => {
        loaded = true;
        loading = false;
        callbacks.splice(0).forEach(cb => cb());
      };
      script.onerror = () => {
        loading = false;
        console.error('Failed to load Fabric.js from CDN:', FABRIC_CDN);
      };
      document.head.appendChild(script);
    }
  }, []);

  return ready;
};