import { useRef, useCallback } from 'react';

/* â”€â”€â”€ RAF-throttled mouse handler hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const useThrottledMouseMove = (handler) => {
  const rafId = useRef(null);
  return useCallback((e) => {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      handler(e);
      rafId.current = null;
    });
  }, [handler]);
};

export default useThrottledMouseMove;
