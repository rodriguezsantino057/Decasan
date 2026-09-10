import { useState } from "react";

const STORAGE_KEY = "decasan_maintenance_unlocked";

/**
 * Modo mantenimiento temporal.
 *
 * - Activado por defecto. Para desactivarlo: VITE_MAINTENANCE_MODE=false
 * - PIN de acceso para pruebas: VITE_MAINTENANCE_PIN (default: "decasan2026")
 * - Acceso directo por URL: https://sitio/?access=<PIN>
 */
export const MAINTENANCE_ENABLED =
  (import.meta.env.VITE_MAINTENANCE_MODE ?? "true") !== "false";

export const MAINTENANCE_PIN =
  import.meta.env.VITE_MAINTENANCE_PIN || "decasan2026";

export function isMaintenanceUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockMaintenance(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // almacenamiento no disponible: ignorar
  }
}

export function useMaintenanceGate() {
  const [unlocked, setUnlocked] = useState(isMaintenanceUnlocked);

  const unlock = () => {
    unlockMaintenance();
    setUnlocked(true);
  };

  return {
    locked: MAINTENANCE_ENABLED && !unlocked,
    unlock,
  };
}