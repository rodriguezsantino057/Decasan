import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, X, RefreshCw, Power, CheckCircle, AlertCircle, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatARS } from "@/lib/format";
import { ProductImage } from "./ProductImage";

interface BarcodeScannerModalProps {
  onClose: () => void;
  onFindProduct: (code: string) => Promise<{ matches: any[] }>;
  onToggleActivo: (p: any) => Promise<void>;
  onEditProduct?: (p: any) => void;
}

export function BarcodeScannerModal({
  onClose,
  onFindProduct,
  onToggleActivo,
  onEditProduct,
}: BarcodeScannerModalProps) {
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [foundProducts, setFoundProducts] = useState<any[]>([]);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  // Iniciar cámaras disponibles
  useEffect(() => {
    let isMounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Preferir cámara trasera si existe
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes("back") ||
            d.label.toLowerCase().includes("trasera") ||
            d.label.toLowerCase().includes("environment")
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setCameraError("No se encontraron cámaras disponibles en este dispositivo.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error al obtener cámaras:", err);
        setCameraError("No se pudo acceder a los permisos de cámara.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Iniciar scanner cuando haya cámara seleccionada
  useEffect(() => {
    if (!selectedCameraId) return;

    const html5QrCode = new Html5Qrcode("barcode-scanner-viewport", {
      verbose: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    });
    scannerRef.current = html5QrCode;

    // Configuración optimizada para códigos de barra horizontales
    const config = {
      fps: 20, // Mayor frecuencia de cuadros para que no se pierda el escaneo
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
        // En celular, los códigos de barra son alargados horizontalmente
        const width = Math.min(viewfinderWidth * 0.9, 360);
        const height = Math.min(viewfinderHeight * 0.5, 180);
        return { width: Math.floor(width), height: Math.floor(height) };
      },
      aspectRatio: 1.0,
      videoConstraints: {
        facingMode: "environment",
        focusMode: "continuous",
      },
    };

    html5QrCode
      .start(
        selectedCameraId,
        config,
        (decodedText) => {
          handleCodeDetected(decodedText);
        },
        () => {
          // Frame sin código detectado, continuar
        }
      )
      .then(() => {
        setScanning(true);
        setCameraError(null);
      })
      .catch((err) => {
        console.error("Error al iniciar scanner:", err);
        setCameraError("Error al iniciar la vista de cámara.");
        setScanning(false);
      });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().then(() => html5QrCode.clear()).catch((e) => console.error(e));
      } else {
        html5QrCode.clear();
      }
    };
  }, [selectedCameraId]);

  async function handleCodeDetected(rawCode: string) {
    const code = rawCode.trim();
    if (!code || isProcessingRef.current) return;
    if (code === lastScannedCode && foundProducts.length > 0) return; // Evitar re-escanear el mismo inmediatamente

    isProcessingRef.current = true;
    setIsSearching(true);
    setLastScannedCode(code);

    // Pequeño feedback háptico si el celular lo soporta
    if (navigator.vibrate) {
      navigator.vibrate(80);
    }

    try {
      const res = await onFindProduct(code);
      if (res.matches && res.matches.length > 0) {
        setFoundProducts(res.matches);
        toast.success(`Producto encontrado: ${res.matches[0].nombre}`);
      } else {
        setFoundProducts([]);
        toast.error(`No se encontró producto con código: ${code}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al buscar producto");
    } finally {
      setIsSearching(false);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1200);
    }
  }

  async function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await handleCodeDetected(manualCode);
  }

  async function handleToggle(p: any) {
    try {
      await onToggleActivo(p);
      setFoundProducts((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, activo: !item.activo } : item))
      );
    } catch (e) {
      // error handled in parent
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background border border-border w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <Camera className="size-5 text-primary" />
            <h2 className="font-display text-lg tracking-wide">Escáner de Productos</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Selector de cámara si hay más de 1 */}
          {cameras.length > 1 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Cámara:</span>
              <select
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
                className="flex-1 bg-background border border-border px-2 py-1 rounded text-xs outline-none focus:border-primary truncate"
              >
                {cameras.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {c.label || `Cámara ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Visor de Cámara */}
          <div className="relative rounded-lg overflow-hidden border border-border bg-black min-h-[300px] sm:min-h-[340px] flex items-center justify-center">
            <div id="barcode-scanner-viewport" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:min-h-[300px] [&_video]:max-h-[380px]" />
            
            {/* Guía visual con puntitos verdes indicadores y marco */}
            {scanning && !cameraError && !isSearching && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
                {/* Cuadro central con esquinas y puntos verdes */}
                <div className="relative w-full max-w-[320px] h-36 border border-emerald-500/40 rounded-lg flex items-center justify-center bg-emerald-500/5">
                  {/* Puntos verdes indicadores en las 4 esquinas */}
                  <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
                  <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-emerald-500" />

                  <span className="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
                  <span className="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-emerald-500" />

                  <span className="absolute -bottom-1.5 -left-1.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
                  <span className="absolute -bottom-1.5 -left-1.5 size-3 rounded-full bg-emerald-500" />

                  <span className="absolute -bottom-1.5 -right-1.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
                  <span className="absolute -bottom-1.5 -right-1.5 size-3 rounded-full bg-emerald-500" />

                  {/* Puntos de foco guía intermedios */}
                  <span className="absolute left-1/4 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-emerald-400/80" />
                  <span className="absolute left-1/2 top-1/2 -translate-y-1/2 size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span className="absolute right-1/4 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-emerald-400/80" />

                  {/* Línea horizontal central */}
                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] opacity-90 animate-pulse" />
                </div>

                <div className="mt-3 flex items-center gap-1.5 bg-black/75 px-3 py-1 rounded-full text-emerald-400 text-xs font-mono border border-emerald-500/30 backdrop-blur-sm">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Enfocá el código dentro de los puntos verdes</span>
                </div>
              </div>
            )}

            {isSearching && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-xs gap-2 backdrop-blur-sm z-10">
                <RefreshCw className="size-6 animate-spin text-emerald-400" />
                <span>Buscando producto...</span>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center p-4 text-center text-xs text-muted-foreground gap-2 z-10">
                <AlertCircle className="size-8 text-amber-500" />
                <p>{cameraError}</p>
                <p className="text-[11px]">Podés ingresar el código manualmente abajo.</p>
              </div>
            )}
          </div>

          {/* Input manual alternativo */}
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="Escribir SKU o código fabricante..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-3 py-2 border border-border bg-background text-sm rounded-md outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!manualCode.trim() || isSearching}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Search className="size-4" /> Buscar
            </button>
          </form>

          {/* Resultado de búsqueda / Producto Encontrado */}
          {lastScannedCode && (
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Último código escaneado: <strong className="font-mono text-foreground">{lastScannedCode}</strong></span>
                {foundProducts.length > 0 && (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle className="size-3.5" /> {foundProducts.length} coincidencia{foundProducts.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {foundProducts.length === 0 && !isSearching && (
                <div className="p-3 bg-muted/40 rounded-lg text-center text-xs text-muted-foreground">
                  No se encontró ningún producto con el código <span className="font-mono">{lastScannedCode}</span>.
                </div>
              )}

              <div className="space-y-2">
                {foundProducts.map((p) => {
                  const isActivo = p.activo !== false;
                  return (
                    <div
                      key={p.id}
                      className="p-3 border border-border rounded-lg bg-surface-elevated flex items-center justify-between gap-3 shadow-sm hover:border-primary/50 transition-colors"
                    >
                      <div className="size-14 bg-muted rounded overflow-hidden shrink-0 border border-border">
                        <ProductImage
                          webp={p.image_webp}
                          src={p.image_url}
                          alt={p.nombre}
                          className="size-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-xs sm:text-sm line-clamp-1">{p.nombre}</h4>
                        <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {p.sku && <span>SKU: {p.sku}</span>}
                          {p.codigo_fabricante && <span>Cód: {p.codigo_fabricante}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-semibold text-xs text-foreground">{formatARS(p.precio)}</span>
                          <span className={`text-[10px] ${p.stock <= 0 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                            Stock: {p.stock}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggle(p)}
                          className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
                            isActivo
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
                          }`}
                        >
                          <Power className="size-3.5" />
                          <span>{isActivo ? "Activo" : "Inactivo"}</span>
                        </button>
                        {onEditProduct && (
                          <button
                            type="button"
                            onClick={() => {
                              onEditProduct(p);
                              onClose();
                            }}
                            className="text-[11px] text-primary hover:underline"
                          >
                            Editar producto
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/20 flex justify-between items-center text-xs text-muted-foreground">
          <span>Alineá el código con la guía de la cámara</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded font-medium hover:bg-secondary/80"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
