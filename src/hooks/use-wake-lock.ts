import { useEffect } from "react";

export function useWakeLock(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        wakeLock = await (navigator as any).wakeLock.request("screen");
        console.log("Wake Lock is active");
        
        wakeLock.addEventListener("release", () => {
          console.log("Wake Lock was released");
        });
      } catch (err: any) {
        console.error(`${err.name}, ${err.message}`);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = async () => {
      if (wakeLock !== null && document.visibilityState === "visible") {
        await requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
      }
    };
  }, [enabled]);
}
