import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Package, MessageCircle } from "lucide-react";
import { Layout } from "@/components/Layout";
import {
  getProfile,
  updateProfile,
  addDireccion,
  deleteDireccion,
  getMyOrders,
} from "@/lib/profile.functions";
import { formatARS } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cuenta")({ component: CuentaPage });

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente de pago",
  pagado: "Pagado",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};
const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-warning/15 text-warning",
  pagado: "bg-info/15 text-info",
  enviado: "bg-info/15 text-info",
  entregado: "bg-success/15 text-success",
  cancelado: "bg-destructive/15 text-destructive",
};
const DNI_RE = /^\d{7,9}$/;
const PHONE_RE = /^\+?\d{8,15}$/;

type ProfileFormValues = {
  nombre?: string | null;
  telefono?: string | null;
  dni?: string | null;
};

type DireccionFormValues = {
  etiqueta: string;
  calle: string;
  numero: string;
  piso: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  telefono: string;
  predeterminada: boolean;
};

function CuentaPage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getProfile);
  const ordersFn = useServerFn(getMyOrders);
  const updateFn = useServerFn(updateProfile);
  const addDirFn = useServerFn(addDireccion);
  const delDirFn = useServerFn(deleteDireccion);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const orders = useQuery({ queryKey: ["orders"], queryFn: () => ordersFn() });

  const [tab, setTab] = useState<"pedidos" | "perfil" | "direcciones">("pedidos");
  const missingProfileData = !!profile.data && !isProfileComplete(profile.data.profile);

  useEffect(() => {
    if (missingProfileData) setTab("perfil");
  }, [missingProfileData]);

  return (
    <Layout>
      <div className="container-x py-10 max-w-5xl">
        <h1 className="font-display text-3xl mb-2">Mi cuenta</h1>
        {profile.data?.profile?.nombre && (
          <p className="text-sm text-muted-foreground mb-8">Hola, {profile.data.profile.nombre}</p>
        )}
        {missingProfileData && (
          <div className="mb-6 border border-primary/30 bg-primary/5 p-4 text-sm">
            Completá tus datos para poder comprar y recibir novedades de tus pedidos.
          </div>
        )}

        <div className="flex border-b border-border mb-8">
          {(["pedidos", "perfil", "direcciones"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 text-sm font-medium capitalize border-b-2 -mb-px ${
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "pedidos" && (
          <div className="space-y-3">
            {orders.isLoading && <p className="text-muted-foreground text-sm">Cargando...</p>}
            {orders.data?.length === 0 && (
              <div className="text-center py-12 border border-dashed border-border">
                <Package className="size-10 mx-auto text-muted-foreground" strokeWidth={1.5} />
                <p className="mt-3 text-sm text-muted-foreground">Todavía no hiciste compras.</p>
              </div>
            )}
            {orders.data?.map((p) => (
              <div key={p.id} className="border border-border p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">
                      #{p.id.slice(0, 8)}
                    </div>
                    <div className="text-sm">{new Date(p.created_at).toLocaleString("es-AR")}</div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium ${ESTADO_COLOR[p.estado]}`}>
                    {ESTADO_LABEL[p.estado]}
                  </span>
                  <div className="font-display text-lg">{formatARS(Number(p.total))}</div>
                </div>
                <ul className="mt-3 text-sm text-muted-foreground space-y-1">
                  {p.pedido_items?.map((it) => (
                    <li key={it.id}>
                      {it.cantidad}× {it.nombre}
                    </li>
                  ))}
                </ul>

                {p.estado === "pendiente" && p.notas?.includes("Efectivo al retirar") && (
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-3 flex-wrap bg-primary/5 p-3">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground block mb-0.5">Retiro y Pago en Efectivo:</span>
                      Retirá tu pedido en el local y pagá al recibirlo.
                    </div>
                    <a
                      href={`https://wa.me/5493548403666?text=${encodeURIComponent(
                        `¡Hola! Acabo de hacer el pedido #${p.id.slice(0, 8)} con retiro en local y pago en efectivo. Quería coordinar para retirar.`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3 py-2 flex items-center gap-1.5 transition-colors font-display tracking-wide uppercase"
                    >
                      <MessageCircle className="size-3.5" /> Coordinar por WhatsApp
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "perfil" && profile.data && (
          <ProfileForm
            initial={profile.data.profile}
            onSubmit={async (v) => {
              await updateFn({ data: v });
              toast.success("Perfil actualizado");
              qc.invalidateQueries({ queryKey: ["profile"] });
            }}
          />
        )}

        {tab === "direcciones" && (
          <div className="space-y-4">
            {profile.data?.direcciones.map((d) => (
              <div
                key={d.id}
                className="border border-border p-4 flex items-start justify-between gap-4"
              >
                <div className="flex gap-3">
                  <MapPin className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">
                      {d.etiqueta || "Dirección"}{" "}
                      {d.predeterminada && (
                        <span className="text-xs text-primary">(predeterminada)</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {d.calle} {d.numero} {d.piso}, {d.ciudad}, {d.provincia} (CP {d.codigo_postal}
                      )
                    </div>
                    {d.telefono && (
                      <div className="text-xs text-muted-foreground mt-1">Tel: {d.telefono}</div>
                    )}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await delDirFn({ data: { id: d.id } });
                    qc.invalidateQueries({ queryKey: ["profile"] });
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
            <DireccionForm
              onSubmit={async (v) => {
                await addDirFn({ data: v });
                toast.success("Dirección agregada");
                qc.invalidateQueries({ queryKey: ["profile"] });
              }}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

function isProfileComplete(profile: ProfileFormValues | null | undefined) {
  return (
    isNameValid(profile?.nombre) && isPhoneValid(profile?.telefono) && isDniValid(profile?.dni)
  );
}

function isNameValid(value: string | null | undefined) {
  const clean = value?.trim() ?? "";
  return clean.length >= 2 && clean.length <= 80;
}

function isPhoneValid(value: string | null | undefined) {
  return PHONE_RE.test(value?.trim() ?? "");
}

function isDniValid(value: string | null | undefined) {
  return DNI_RE.test(value?.trim() ?? "");
}

function ProfileForm({
  initial,
  onSubmit,
}: {
  initial: ProfileFormValues | null;
  onSubmit: (v: ProfileFormValues) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  const [dni, setDni] = useState(initial?.dni ?? "");
  const [busy, setBusy] = useState(false);
  const nameOk = isNameValid(nombre);
  const phoneOk = isPhoneValid(telefono);
  const dniOk = isDniValid(dni);
  const canSubmit = nameOk && phoneOk && dniOk && !busy;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        try {
          await onSubmit({ nombre, telefono, dni });
        } finally {
          setBusy(false);
        }
      }}
      className="max-w-md space-y-4"
      noValidate
    >
      <Field
        label="Nombre"
        value={nombre}
        onChange={(value) => setNombre(value.replace(/[^\p{L}\s'.-]/gu, ""))}
        required
        maxLength={80}
        error={nombre && !nameOk ? "Ingresá tu nombre completo (mínimo 2 caracteres)." : undefined}
      />
      <Field
        label="Teléfono"
        value={telefono}
        onChange={(value) => setTelefono(value.replace(/[^\d+]/g, "").slice(0, 16))}
        required
        inputMode="tel"
        placeholder="+5491122334455"
        error={telefono && !phoneOk ? "Teléfono inválido (8 a 15 dígitos, opcional +)." : undefined}
      />
      <Field
        label="DNI / CUIT"
        value={dni}
        onChange={(value) => setDni(value.replace(/\D/g, "").slice(0, 9))}
        required
        inputMode="numeric"
        placeholder="Sin puntos"
        error={dni && !dniOk ? "El DNI debe tener entre 7 y 9 dígitos." : undefined}
      />
      <button
        disabled={!canSubmit}
        className="bg-primary text-primary-foreground px-5 py-2.5 font-display tracking-wide hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Guardar
      </button>
    </form>
  );
}

function DireccionForm({ onSubmit }: { onSubmit: (v: DireccionFormValues) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    etiqueta: "",
    calle: "",
    numero: "",
    piso: "",
    ciudad: "",
    provincia: "",
    codigo_postal: "",
    telefono: "",
    predeterminada: false,
  });
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="border border-dashed border-border p-4 w-full text-sm text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center gap-2"
      >
        <Plus className="size-4" /> Agregar dirección
      </button>
    );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await onSubmit(v);
        setOpen(false);
        setV({
          etiqueta: "",
          calle: "",
          numero: "",
          piso: "",
          ciudad: "",
          provincia: "",
          codigo_postal: "",
          telefono: "",
          predeterminada: false,
        });
      }}
      className="border border-border p-4 grid sm:grid-cols-2 gap-3"
    >
      <Field
        label="Etiqueta (Casa, Trabajo)"
        value={v.etiqueta}
        onChange={(x) => setV({ ...v, etiqueta: x })}
      />
      <Field label="Teléfono" value={v.telefono} onChange={(x) => setV({ ...v, telefono: x })} />
      <Field label="Calle" value={v.calle} onChange={(x) => setV({ ...v, calle: x })} required />
      <Field label="Número" value={v.numero} onChange={(x) => setV({ ...v, numero: x })} />
      <Field label="Piso/Depto" value={v.piso} onChange={(x) => setV({ ...v, piso: x })} />
      <Field
        label="Código postal"
        value={v.codigo_postal}
        onChange={(x) => setV({ ...v, codigo_postal: x })}
        required
      />
      <Field label="Ciudad" value={v.ciudad} onChange={(x) => setV({ ...v, ciudad: x })} required />
      <Field
        label="Provincia"
        value={v.provincia}
        onChange={(x) => setV({ ...v, provincia: x })}
        required
      />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={v.predeterminada}
          onChange={(e) => setV({ ...v, predeterminada: e.target.checked })}
        />
        Usar como predeterminada
      </label>
      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          className="bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
        >
          Guardar
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  inputMode,
  placeholder,
  maxLength,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  placeholder?: string;
  maxLength?: number;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full mt-1 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}
