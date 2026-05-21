import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

type ProtectedRouteProps = Readonly<{
  children: ReactNode;
  fallback?: ReactNode;
}>;

export function ProtectedRoute({ children, fallback = null }: ProtectedRouteProps) {
  const { isAuthenticated, isLoadingSession } = useAuth();

  if (isLoadingSession) {
    return <div className="page-inner">Cargando sesión...</div>;
  }

  if (!isAuthenticated) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
