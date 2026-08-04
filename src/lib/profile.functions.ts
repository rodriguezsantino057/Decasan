import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: direcciones }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("direcciones")
        .select("*")
        .eq("user_id", userId)
        .order("predeterminada", { ascending: false }),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      profile,
      direcciones: direcciones ?? [],
      isAdmin: (roles ?? []).some((r) => r.role === "admin"),
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        nombre: z
          .string()
          .trim()
          .min(2, "Ingresá tu nombre completo.")
          .max(80, "El nombre es demasiado largo.")
          .regex(/^[\p{L}\s'.-]+$/u, "El nombre solo puede incluir letras y espacios."),
        telefono: z
          .string()
          .trim()
          .regex(/^\+?\d{8,15}$/, "Teléfono inválido."),
        dni: z
          .string()
          .trim()
          .regex(/^\d{7,9}$/, "El DNI debe tener entre 7 y 9 dígitos."),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      nombre: data.nombre,
      telefono: data.telefono ?? null,
      dni: data.dni ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const direccionSchema = z.object({
  etiqueta: z.string().trim().max(50).optional().nullable(),
  calle: z.string().trim().min(1).max(120),
  numero: z.string().trim().max(20).optional().nullable(),
  piso: z.string().trim().max(20).optional().nullable(),
  ciudad: z.string().trim().min(1).max(80),
  provincia: z.string().trim().min(1).max(80),
  codigo_postal: z.string().trim().min(1).max(20),
  telefono: z.string().trim().max(40).optional().nullable(),
  predeterminada: z.boolean().optional(),
});

export const addDireccion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => direccionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.predeterminada) {
      await supabase.from("direcciones").update({ predeterminada: false }).eq("user_id", userId);
    }
    const { error } = await supabase.from("direcciones").insert({ ...data, user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDireccion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("direcciones").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("pedidos")
      .select("id, estado, total, created_at, pedido_items(id, nombre, cantidad, subtotal)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
