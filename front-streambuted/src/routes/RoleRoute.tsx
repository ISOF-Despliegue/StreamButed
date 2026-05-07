import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import type { UserRole } from "../types/user.types";

interface RoleRouteProps {
  allowedRoles: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function RoleRoute({ allowedRoles, children, fallback }: RoleRouteProps) {
  const { user, isAuthenticated, isLoadingSession } = useAuth();

  if (isLoadingSession) {
    return <div className="page-inner">Cargando sesion...</div>;
  }

  if (!isAuthenticated || !user || !allowedRoles.includes(user.role)) {
    return (
      <>
        {fallback ?? (
          <div className="page-inner">
            <div className="empty-state">
              <div className="empty-text">No tienes permisos para esta vista.</div>
            </div>
          </div>
        )}
      </>
    );
  }

  return <>{children}</>;
}
