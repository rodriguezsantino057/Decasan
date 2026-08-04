import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/lib/auth";
import { Layout } from "@/components/Layout";

export const Route = createFileRoute("/_authenticated")({ component: AuthGate });

function AuthGate() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", search: { redirect: location.pathname, mode: "login" } });
    }
  }, [loading, user, navigate, location.pathname]);

  if (loading || !user) {
    return (
      <Layout>
        <div className="container-x py-20 text-center text-muted-foreground">Cargando...</div>
      </Layout>
    );
  }
  return <Outlet />;
}
