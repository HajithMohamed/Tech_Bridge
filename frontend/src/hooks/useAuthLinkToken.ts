import { useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function useAuthLinkToken(): string {
  const location = useLocation();
  // Capture only in memory. The initializer stays pure under React Strict Mode.
  const [token] = useState(() => {
    const candidate = new URLSearchParams((location.hash || window.location.hash).replace(/^#/, '')).get('token') || '';
    return /^[A-Za-z0-9_-]{32,512}$/.test(candidate) ? candidate : '';
  });
  useLayoutEffect(() => {
    // URL fragments never reach the server; remove the fragment before painting.
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);
  return token;
}
