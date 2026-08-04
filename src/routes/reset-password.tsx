import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { sendPasswordChangedEmail } from "@/lib/auth.functions";

export const Route = createFileRoute("/reset-password")({ component: ResetPassword });

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const sendPasswordChangedFn = useServerFn(sendPasswordChangedEmail);

  const passChecks = useMemo(() => ({
    len: password.length >= 8,
    lower: /[a-z]/.test(password),
    upper: /[A-Z]/.test(password),
    num: /\d/.test(password),
  }), [password]);
  const passOk = passChecks.len && passChecks.lower && passChecks.upper && passChecks.num;
  const matches = password.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passOk) return toast.error("La contrasena no cumple los requisitos.");
    if (!matches) return toast.error("Las contrasenas no coinciden.");

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    await sendPasswordChangedFn().catch(() => null);
    toast.success("Contrasena actualizada");
    navigate({ to: "/cuenta" });
  }

  return (
    <Layout>
      <div className="container-x max-w-md py-16">
        <h1 className="font-display text-3xl mb-6">Nueva contrasena</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Nueva contrasena"
            className="w-full border border-border bg-background px-3 py-2.5 outline-none focus:border-primary"
          />
          <ul className="text-xs space-y-1">
            <PassReq ok={passChecks.len} label="Minimo 8 caracteres" />
            <PassReq ok={passChecks.lower} label="Una minuscula (a-z)" />
            <PassReq ok={passChecks.upper} label="Una mayuscula (A-Z)" />
            <PassReq ok={passChecks.num} label="Un numero (0-9)" />
          </ul>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repetir nueva contrasena"
            className="w-full border border-border bg-background px-3 py-2.5 outline-none focus:border-primary"
          />
          {confirmPassword && !matches && (
            <p className="text-xs text-destructive">Las contrasenas no coinciden.</p>
          )}
          <button
            type="submit"
            disabled={loading || !passOk || !matches}
            className="w-full bg-primary text-primary-foreground py-3 font-display tracking-wide hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </form>
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
