import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff, Check, X } from "lucide-react";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import {
  canonicalGmail,
  checkGmailAvailability,
  sendLoginSuccessEmail,
} from "@/lib/auth.functions";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/cuenta",
    mode: s.mode === "register" ? "register" : "login",
  }),
  component: LoginPage,
});

const GMAIL_RE = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
const DNI_RE = /^\d{7,9}$/;
const PHONE_RE = /^\+?\d{8,15}$/;

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("email not confirmed"))
    return "Tenés que confirmar tu email antes de ingresar. Revisá tu casilla (y Spam).";
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos.";
  if (m.includes("user already registered") || m.includes("already registered"))
    return "Ya existe una cuenta con ese email. Iniciá sesión.";
  if (m.includes("duplicate key") && m.includes("dni")) return "Ya existe una cuenta con ese DNI.";
  if (m.includes("rate limit")) return "Demasiados intentos. Esperá unos minutos.";
  if (m.includes("password should be at least"))
    return "La contraseña debe tener al menos 8 caracteres.";
  if (m.includes("invalid email") || m.includes("unable to validate email"))
    return "El email no es válido.";
  if (m.includes("signup is disabled")) return "El registro está deshabilitado temporalmente.";
  if (m.includes("network")) return "Error de red. Verificá tu conexión.";
  return msg;
}

function LoginPage() {
  const search = useSearch({ from: "/login" });
  const navigate = useNavigate();
  const { user, loading: sessionLoading } = useSession();
  const [mode, setMode] = useState<"login" | "register">(search.mode as "login" | "register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState<string | null>(null);
  const handledSessionRef = useRef(false);
  const checkEmailFn = useServerFn(checkGmailAvailability);
  const sendLoginEmailFn = useServerFn(sendLoginSuccessEmail);

  useEffect(() => {
    if (sessionLoading || !user || handledSessionRef.current) return;
    handledSessionRef.current = true;
    sendLoginEmailFn().catch(() => null);
    navigate({ to: search.redirect });
  }, [sessionLoading, user, navigate, search.redirect, sendLoginEmailFn]);

  const passChecks = useMemo(
    () => ({
      len: password.length >= 8,
      lower: /[a-z]/.test(password),
      upper: /[A-Z]/.test(password),
      num: /\d/.test(password),
    }),
    [password],
  );
  const passOk = passChecks.len && passChecks.lower && passChecks.upper && passChecks.num;

  const emailOk = GMAIL_RE.test(email.trim());
  const dniOk = DNI_RE.test(dni);
  const phoneOk = PHONE_RE.test(telefono);
  const nameOk = nombre.trim().length >= 2 && nombre.trim().length <= 80;

  const canSubmit =
    mode === "login"
      ? emailOk && password.length >= 8
      : emailOk && nameOk && dniOk && phoneOk && passOk;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setNeedsConfirm(null);
    try {
      if (mode === "register") {
        if (!GMAIL_RE.test(email.trim()))
          throw new Error("El email debe ser una cuenta de Gmail (@gmail.com).");
        if (!DNI_RE.test(dni)) throw new Error("El DNI debe tener entre 7 y 9 dígitos.");
        if (!PHONE_RE.test(telefono)) throw new Error("Teléfono inválido.");
        if (!passOk) throw new Error("La contraseña no cumple los requisitos.");

        const normalizedEmail = email.trim().toLowerCase();
        const availability = await checkEmailFn({ data: { email: normalizedEmail } });
        if (!availability.available) {
          throw new Error(
            "Ya existe una cuenta con ese Gmail. Iniciá sesión o recuperá tu contraseña.",
          );
        }

        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              nombre: nombre.trim(),
              dni,
              telefono,
              email_canonical: canonicalGmail(normalizedEmail),
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNeedsConfirm(email);
          toast.success("Cuenta creada. Te enviamos un email para confirmarla.");
          setMode("login");
        } else {
          toast.success("Bienvenido");
          navigate({ to: search.redirect });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        toast.success("Bienvenido");
        navigate({ to: search.redirect });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Error";
      if (/email.*not.*confirm/i.test(raw)) setNeedsConfirm(email);
      toast.error(translateAuthError(raw));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirm() {
    const target = needsConfirm || email;
    if (!target) return toast.error("Ingresá tu email primero");
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: target,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) toast.error(translateAuthError(error.message));
    else toast.success("Te reenviamos el email de confirmación");
  }

  async function handleReset() {
    if (!emailOk) return toast.error("Ingresá un email @gmail.com válido");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(translateAuthError(error.message));
    else toast.success("Te enviamos un email para restablecer la contraseña");
  }

  async function handleGoogleLogin() {
    if (loading) return;
    setLoading(true);
    setNeedsConfirm(null);
    const redirectTo = `${window.location.origin}/login?redirect=${encodeURIComponent(search.redirect)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      setLoading(false);
      toast.error(translateAuthError(error.message));
    }
  }

  const inputCls =
    "w-full mt-1 border border-border bg-background px-3 py-2.5 outline-none focus:border-primary";

  return (
    <Layout>
      <div className="container-x max-w-md py-16">
        <h1 className="font-display text-3xl mb-2">
          {mode === "login" ? "Ingresar" : "Crear cuenta"}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {mode === "login"
            ? "Accedé para ver tus pedidos y comprar."
            : "Registrate con tu cuenta de Gmail."}
        </p>

        {needsConfirm && (
          <div className="mb-6 border border-border bg-muted/40 p-3 text-sm">
            <p className="mb-2">
              Aún no confirmaste el email <strong>{needsConfirm}</strong>. Revisá tu bandeja y la
              carpeta de Spam.
            </p>
            <button
              type="button"
              onClick={handleResendConfirm}
              disabled={loading}
              className="text-primary hover:underline disabled:opacity-50"
            >
              Reenviar email de confirmación
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mb-5 w-full border border-border bg-background py-3 font-medium hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar con Google
        </button>

        <div className="mb-5 flex items-center gap-3 text-xs uppercase text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>o</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === "register" && (
            <>
              <div>
                <label className="text-sm font-medium">Nombre completo</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value.replace(/[^\p{L}\s'.-]/gu, ""))}
                  required
                  autoComplete="name"
                  maxLength={80}
                  className={inputCls}
                />
                {nombre && !nameOk && (
                  <p className="text-xs text-destructive mt-1">
                    Ingresá tu nombre completo (mínimo 2 caracteres).
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">DNI</label>
                <input
                  value={dni}
                  onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  required
                  inputMode="numeric"
                  autoComplete="off"
                  className={inputCls}
                  placeholder="Sin puntos"
                />
                {dni && !dniOk && (
                  <p className="text-xs text-destructive mt-1">
                    El DNI debe tener entre 7 y 9 dígitos.
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Teléfono</label>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/[^\d+]/g, "").slice(0, 16))}
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  className={inputCls}
                  placeholder="+5491122334455"
                />
                {telefono && !phoneOk && (
                  <p className="text-xs text-destructive mt-1">
                    Teléfono inválido (8 a 15 dígitos, opcional +).
                  </p>
                )}
              </div>
            </>
          )}
          <div>
            <label className="text-sm font-medium">Email (Gmail)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              required
              autoComplete="email"
              className={inputCls}
              placeholder="tuusuario@gmail.com"
            />
            {email && !emailOk && (
              <p className="text-xs text-destructive mt-1">Solo se aceptan cuentas @gmail.com.</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Contraseña</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                minLength={8}
                className={inputCls + " pr-10"}
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === "register" && (
              <ul className="mt-2 text-xs space-y-1">
                <PassReq ok={passChecks.len} label="Mínimo 8 caracteres" />
                <PassReq ok={passChecks.lower} label="Una minúscula (a-z)" />
                <PassReq ok={passChecks.upper} label="Una mayúscula (A-Z)" />
                <PassReq ok={passChecks.num} label="Un número (0-9)" />
              </ul>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full bg-primary text-primary-foreground py-3 font-display tracking-wide hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "..." : mode === "login" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setNeedsConfirm(null);
            }}
            className={
              mode === "login"
                ? "border border-black px-3 py-1 hover:bg-black hover:text-white transition"
                : "text-primary hover:underline"
            }
          >
            {mode === "login" ? "Crear cuenta nueva" : "Ya tengo cuenta"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              onClick={handleReset}
              className="border border-black px-3 py-1 hover:bg-black hover:text-white transition"
            >
              Olvidé mi contraseña
            </button>
          )}
        </div>
        <Link
          to="/"
          className="inline-block text-center mt-8 text-xs border border-black px-3 py-1 hover:bg-black hover:text-white transition"
        >
          ← Volver al inicio
        </Link>
      </div>
    </Layout>
  );
}

function PassReq({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-green-600" : "text-muted-foreground"}`}>
      {ok ? <Check size={14} /> : <X size={14} />}
      <span>{label}</span>
    </li>
  );
}
