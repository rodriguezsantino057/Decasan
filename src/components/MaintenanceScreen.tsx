import { useEffect, useState } from "react";
import { MAINTENANCE_PIN } from "@/lib/maintenance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MaintenanceScreen({ onUnlock }: { onUnlock: () => void }) {
  const [showAccess, setShowAccess] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  // Acceso directo vía ?access=PIN (para compartir link de prueba)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("access") === MAINTENANCE_PIN) {
      onUnlock();
      const url = new URL(window.location.href);
      url.searchParams.delete("access");
      window.history.replaceState({}, "", url.toString());
    }
  }, [onUnlock]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === MAINTENANCE_PIN) {
      onUnlock();
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-center">
      {/* decoración sutil */}
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-secondary/10 blur-3xl" />

      <img
        src="/logo.png"
        alt="Decasan Home Center"
        className="mb-8 h-14 w-auto object-contain sm:h-16"
      />

      <span className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-secondary-foreground">
        <span className="size-2 animate-pulse rounded-full bg-primary" />
        Próximamente
      </span>

      <h1 className="font-display mb-3 text-3xl font-bold uppercase tracking-tight text-foreground sm:text-4xl">
        Página en construcción
      </h1>

      <p className="mb-10 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
        Estamos preparando el catálogo con los primeros productos. Muy pronto vas a poder
        comprar online en{" "}
        <span className="font-semibold text-foreground">Decasan Home Center</span>.
      </p>

      <div className="w-full max-w-xs">
        {!showAccess ? (
          <button
            type="button"
            onClick={() => setShowAccess(true)}
            className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Acceso para pruebas
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <Input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              placeholder="PIN de acceso"
              autoFocus
              className="text-center"
            />
            {error && (
              <p className="text-xs text-destructive">PIN incorrecto, intentá de nuevo.</p>
            )}
            <Button type="submit" className="w-full">
              Ingresar
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}