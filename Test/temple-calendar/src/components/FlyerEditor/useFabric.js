// Fabric v6 UMD build via cdnjs
import { useState, useEffect } from 'react';
const FABRIC_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';
// Subresource Integrity — pins the script to this exact file so a
// compromised/tampered cdnjs response is refused by the browser instead of
// executing. Hash verified 2026-09-04 by fetching the live CDN URL above
// and computing its real SHA-384 digest (not derived from a package
// registry copy, which can differ byte-for-byte from what a CDN serves).
const FABRIC_CDN_INTEGRITY = 'sha384-sLpuECXYCB5TUyTbC06pftm/rgurDambREZmV4eRHwEqJzCQtU6lxI2Ve00z4XW5';

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
      script.integrity = FABRIC_CDN_INTEGRITY;
      script.crossOrigin = 'anonymous';
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