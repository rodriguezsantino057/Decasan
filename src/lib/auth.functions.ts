import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { escapeHtml, sendTransactionalEmail } from "@/lib/email";

const gmailSchema = z.string().trim().email().regex(/^[a-zA-Z0-9._%+-]+@gmail\.com$/, "Solo se aceptan cuentas Gmail");

export function canonicalGmail(email: string): string {
  const [local] = email.trim().toLowerCase().split("@");
  const cleanLocal = local.split("+")[0].replace(/\./g, "");
  return `${cleanLocal}@gmail.com`;
}

export const checkGmailAvailability = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ email: gmailSchema }).parse(d))
  .handler(async ({ data }) => {
    const canonical = canonicalGmail(data.email);
    let page = 1;

    while (page <= 20) {
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) {
        console.error("[auth] gmail availability check failed", error.message);
        throw new Error("No pudimos validar el email. Intentá nuevamente.");
      }

      const exists = users.users.some((user) => user.email && canonicalGmail(user.email) === canonical);
      if (exists) return { available: false, canonical };
      if (users.users.length < 1000) break;
      page += 1;
    }

    return { available: true, canonical };
  });

export const sendLoginSuccessEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const user = await getAuthUser(context.userId);
    const to = user?.email;
    if (!to) return { ok: false };

    const profile = await getProfileForAuthEmail(context.userId);
    const subject = "Inicio de sesion correcto en Decasan";
    const html = authEmailShell({
      title: "Inicio de sesion correcto",
      greetingName: profile?.nombre,
      body: `
        <p>Detectamos un ingreso correcto a tu cuenta de Decasan.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>
        <p>Si fuiste vos, no hace falta hacer nada. Si no reconoces este acceso, cambia tu contrasena o escribinos por WhatsApp.</p>
      `,
    });

    await sendTransactionalEmail({
      to,
      subject,
      html,
      logContext: { kind: "login_success", userId: context.userId },
    });

    return { ok: true };
  });

export const sendPasswordChangedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const user = await getAuthUser(context.userId);
    const to = user?.email;
    if (!to) return { ok: false };

    const profile = await getProfileForAuthEmail(context.userId);
    const subject = "Tu contrasena de Decasan fue actualizada";
    const html = authEmailShell({
      title: "Contrasena actualizada",
      greetingName: profile?.nombre,
      body: `
        <p>Te confirmamos que la contrasena de tu cuenta fue actualizada correctamente.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}</p>
        <p>Si no hiciste este cambio, contactanos de inmediato por WhatsApp.</p>
      `,
    });

    await sendTransactionalEmail({
      to,
      subject,
      html,
      logContext: { kind: "password_changed", userId: context.userId },
    });

    return { ok: true };
  });

async function getAuthUser(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error) {
    console.warn("[auth-email] user lookup failed", { userId, error: error.message });
    return null;
  }
  return data.user;
}

async function getProfileForAuthEmail(userId: string): Promise<{ nombre: string | null } | null> {
  const { data, error } = await supabaseAdmin.from("profiles").select("nombre").eq("id", userId).maybeSingle();
  if (error) {
    console.warn("[auth-email] profile lookup failed", { userId, error: error.message });
    return null;
  }
  return data;
}

function authEmailShell({
  title,
  greetingName,
  body,
}: {
  title: string;
  greetingName?: string | null;
  body: string;
}) {
  return `
    <div style="font-family:Arial,sans-serif;color:#1f2933;line-height:1.45;max-width:600px;margin:0 auto">
      <h1 style="font-size:24px;margin:0 0 8px">${escapeHtml(title)}</h1>
      <p style="margin:0 0 18px">Hola ${escapeHtml(greetingName || "cliente")},</p>
      ${body}
      <div style="border-top:1px solid #e5e7eb;margin-top:22px;padding-top:14px;font-size:13px;color:#64748b">
        Decasan Herramientas - Av. Pres. Kennedy 270, La Falda, Cordoba<br />
        WhatsApp: +54 9 3548 40-3666
      </div>
    </div>
  `;
}
