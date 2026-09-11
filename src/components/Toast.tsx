"use client";

import { useCallback, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  return { toast, showToast };
}

export function ToastBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white px-5 py-3 rounded-[10px] text-sm font-medium z-[200] shadow-lg"
      role="status"
    >
      {message}
    </div>
  );
}
