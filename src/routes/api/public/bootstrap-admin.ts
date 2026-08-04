import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// One-shot endpoint to create the initial admin user. Returns 410 once an admin already exists.
export const Route = createFileRoute("/api/public/bootstrap-admin")({
  server: {
    handlers: {
      POST: async () => {
        const { data: existing } = await supabaseAdmin
          .from("user_roles").select("user_id").eq("role", "admin").limit(1);
        if (existing && existing.length > 0) {
          return new Response(JSON.stringify({ ok: false, reason: "admin_exists" }), { status: 410, headers: { "content-type": "application/json" } });
        }

        const email = "decasanadmin@decasan.com.ar";
        const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "Decasan2025!" + Math.random().toString(36).slice(2, 8);

        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { nombre: "DecasanAdmin" },
        });
        if (error || !created.user) {
          return new Response(JSON.stringify({ ok: false, error: error?.message }), { status: 500, headers: { "content-type": "application/json" } });
        }

        await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" });

        return new Response(JSON.stringify({ ok: true, email, password }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
