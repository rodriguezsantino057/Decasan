import { createFileRoute, Outlet, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession, useIsAdmin } from "@/lib/auth";
import { Layout } from "@/components/Layout";
import { LayoutDashboard, Package, ShoppingBag, Truck, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminLayout });

function AdminLayout() {
  const { user, loading } = useSession();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin(user);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !roleLoading && user && !isAdmin) navigate({ to: "/" });
  }, [loading, roleLoading, user, isAdmin, navigate]);

  if (loading || roleLoading || !isAdmin) {
    return <Layout><div className="container-x py-20 text-center text-muted-foreground">Verificando permisos...</div></Layout>;
  }

  const tabs = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/admin/productos", label: "Productos", icon: Package, exact: false },
    { to: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag, exact: false },
    { to: "/admin/usuarios", label: "Usuarios", icon: Users, exact: false },
    { to: "/admin/envios", label: "Envios", icon: Truck, exact: false },
  ];

  return (
    <Layout>
      <div className="container-x py-5 sm:py-8">
        <h1 className="font-display text-2xl sm:text-3xl leading-tight mb-1">Panel de administracion</h1>
        <p className="text-sm text-muted-foreground mb-5 sm:mb-6">Gestion de productos, pedidos y usuarios</p>

        <div className="-mx-4 flex overflow-x-auto border-y border-border bg-surface-elevated sm:mx-0 sm:mb-8 sm:grid sm:grid-cols-5 sm:border-x">
          {tabs.map((t) => {
            const active = t.exact ? location.pathname === t.to : location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`px-4 py-3 text-sm font-medium flex flex-1 items-center justify-center gap-2 whitespace-nowrap border-b-2 sm:border-b-0 sm:border-t-2 ${
                  active ? "border-primary bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="size-4" /> {t.label}
              </Link>
            );
          })}
        </div>

        <Outlet />
      </div>
    </Layout>
  );
}
