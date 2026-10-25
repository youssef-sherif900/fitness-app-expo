import { useCallback, useRef, useState } from 'react';

/** One toast at a time, auto-dismiss after 5s. */
export function useToast() {
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((message: string, onUndo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, onUndo: onUndo ? () => { onUndo(); setToast(null); } : undefined });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  return { toast, show };
}
