import { useEffect, useState } from "react";
import { BACKEND_URL } from "@/lib/api";

export function BackendBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!BACKEND_URL) {
      setOffline(true);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/`, { credentials: "include" });
        if (!cancelled) setOffline(!r.ok);
      } catch {
        if (!cancelled) setOffline(true);
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-amber-500/95 text-black px-4 py-3 text-sm text-center font-medium">
      API hors ligne — lance le backend :{" "}
      <code className="bg-black/10 px-1 rounded">cd backend && uvicorn server:app --reload --port 8000</code>
      {" "}(MongoDB requis)
    </div>
  );
}
