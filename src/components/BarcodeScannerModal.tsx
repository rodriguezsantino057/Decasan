import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { createWorker } from "tesseract.js";
import { Camera, X, RefreshCw, Power, CheckCircle, AlertCircle, Search, ScanBarcode, Type } from "lucide-react";
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
  const [mode, setMode] = useState<"barcode" | "ocr">("barcode");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isOcrReading, setIsOcrReading] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [foundProducts, setFoundProducts] = useState<any[]>([]);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const ocrWorkerRef = useRef<any>(null);

  // Inicializar cámaras
  useEffect(() => {
    let isMounted = true;
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (!isMounted) return;
        if (devices && devices.length > 0) {
          setCameras(devices);
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

  // Iniciar scanner de cámara
  useEffect(() => {
    if (!selectedCameraId) return;

    const html5QrCode = new Html5Qrcode("barcode-scanner-viewport", {
      verbose: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true,
      },
    });
    scannerRef.current = html5QrCode;

    const config = {
      fps: 20,
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
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
          if (mode === "barcode") {
            handleCodeDetected(decodedText);
          }
        },
        () => {}
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

  // Limpiar worker de OCR al desmontar
  useEffect(() => {
    return () => {
      if (ocrWorkerRef.current) {
        ocrWorkerRef.current.terminate();
      }
    };
  }, []);

  async function handleCodeDetected(rawCode: string) {
    const code = rawCode.trim();
    if (!code || isProcessingRef.current) return;
    if (code === lastScannedCode && foundProducts.length > 0) return;

    isProcessingRef.current = true;
    setIsSearching(true);
    setLastScannedCode(code);

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

  // Capturar foto del video y leer números (OCR)
  async function captureAndReadNumbers() {
    const video = document.querySelector("#barcode-scanner-viewport video") as HTMLVideoElement | null;
    if (!video || isOcrReading) return;

    setIsOcrReading(true);
    toast.info("Leyendo números de la imagen...");

    try {
      // Capturar frame en canvas
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No se pudo iniciar el canvas");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Cargar worker tesseract si no está cargado
      if (!ocrWorkerRef.current) {
        const worker = await createWorker("eng");
        await worker.setParameters({
          tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-",
        });
        ocrWorkerRef.current = worker;
      }

      const ret = await ocrWorkerRef.current.recognize(canvas);
      const text = ret.data.text || "";
      console.log("OCR leído:", text);

      // Extraer secuencias alfanuméricas de 3 o más dígitos (ej: 6224, AA237)
      const matches = text.match(/[A-Z0-9-]{3,12}/g) || [];
      const cleanMatches = [...new Set(matches.filter((m: string) => /\d/.test(m)))];

      if (cleanMatches.length === 0) {
        toast.error("No se detectaron números claros. Acercá la cámara o enfoca mejor.");
        setIsOcrReading(false);
        return;
      }

      toast.info(`Probando códigos: ${cleanMatches.join(", ")}`);

      // Probar los códigos detectados con prioridad a los que coincidan
      let found: any[] = [];
      let matchedCode = "";

      for (const candidate of cleanMatches) {
        const res = await onFindProduct(candidate);
        if (res.matches && res.matches.length > 0) {
          found = res.matches;
          matchedCode = candidate;
          break;
        }
      }

      if (found.length > 0) {
        setLastScannedCode(matchedCode);
        setFoundProducts(found);
        setManualCode(matchedCode);
        if (navigator.vibrate) navigator.vibrate(100);
        toast.success(`¡Encontrado código ${matchedCode}!`);
      } else {
        setLastScannedCode(cleanMatches[0]);
        setManualCode(cleanMatches[0]);
        setFoundProducts([]);
        toast.error(`Códigos leídos (${cleanMatches.join(", ")}), pero no coinciden en la base.`);
      }
    } catch (err: any) {
      console.error("Error en OCR:", err);
      toast.error(err?.message || "Error al leer imagen");
    } finally {
      setIsOcrReading(false);
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
          {/* Selector de modo: Código de Barras vs Números (OCR) */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode("barcode")}
              className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                mode === "barcode"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ScanBarcode className="size-4 text-primary" />
              <span>Código de Barras</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("ocr")}
              className={`py-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                mode === "ocr"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Type className="size-4 text-emerald-500" />
              <span>Leer Números / Texto</span>
            </button>
          </div>

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
            {scanning && !cameraError && !isSearching && !isOcrReading && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
                <div className="relative w-full max-w-[320px] h-36 border border-emerald-500/40 rounded-lg flex items-center justify-center bg-emerald-500/5">
                  <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
                  <span className="absolute -top-1.5 -left-1.5 size-3 rounded-full bg-emerald-500" />

                  <span className="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
                  <span className="absolute -top-1.5 -right-1.5 size-3 rounded-full bg-emerald-500" />

                  <span className="absolute -bottom-1.5 -left-1.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
                  <span className="absolute -bottom-1.5 -left-1.5 size-3 rounded-full bg-emerald-500" />

                  <span className="absolute -bottom-1.5 -right-1.5 size-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
                  <span className="absolute -bottom-1.5 -right-1.5 size-3 rounded-full bg-emerald-500" />

                  <span className="absolute left-1/4 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-emerald-400/80" />
                  <span className="absolute left-1/2 top-1/2 -translate-y-1/2 size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                  <span className="absolute right-1/4 top-1/2 -translate-y-1/2 size-1.5 rounded-full bg-emerald-400/80" />

                  <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#34d399] opacity-90 animate-pulse" />
                </div>

                <div className="mt-3 flex items-center gap-1.5 bg-black/75 px-3 py-1 rounded-full text-emerald-400 text-xs font-mono border border-emerald-500/30 backdrop-blur-sm">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{mode === "barcode" ? "Enfocá el código de barras" : "Apuntá al número impreso"}</span>
                </div>
              </div>
            )}

            {(isSearching || isOcrReading) && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white text-xs gap-2 backdrop-blur-sm z-10">
                <RefreshCw className="size-6 animate-spin text-emerald-400" />
                <span>{isOcrReading ? "Leyendo número de la etiqueta..." : "Buscando en la base de datos..."}</span>
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

          {/* Botón de Captura para modo OCR (Números impresos) */}
          {mode === "ocr" && (
            <button
              type="button"
              onClick={captureAndReadNumbers}
              disabled={isOcrReading || isSearching}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg shadow-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Camera className="size-4" />
              <span>{isOcrReading ? "Analizando imagen..." : "📸 Capturar y Leer Número (OCR)"}</span>
            </button>
          )}

          {/* Input manual alternativo */}
          <form onSubmit={handleManualSearch} className="flex gap-2">
            <input
              type="text"
              placeholder="O escribir código / número a mano (ej: 6224)..."
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
                <span>Código detectado: <strong className="font-mono text-foreground">{lastScannedCode}</strong></span>
                {foundProducts.length > 0 && (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle className="size-3.5" /> {foundProducts.length} coincidencia{foundProducts.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {foundProducts.length === 0 && !isSearching && !isOcrReading && (
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
          <span>{mode === "barcode" ? "Escaneo automático de barras" : "Capturá el número con la cámara"}</span>
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
