import { type ReactNode, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { IcMenu, IcX } from "../icons/Icons";

export type MobileNavItem = Readonly<{
  end?: boolean;
  icon: ReactNode;
  label: string;
  to: string;
}>;

type ResponsiveAppShellProps = Readonly<{
  brandTarget: string;
  brandSubtitle: string;
  children: ReactNode;
  isMobile: boolean;
  isSidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  mobileProfile?: ReactNode;
  mobileSidebar?: ReactNode;
  onCloseMobileMenu: () => void;
  onOpenMobileMenu: () => void;
  showMobileMenuButton?: boolean;
  sidebar: ReactNode;
}>;

function getMobileTitle(pathname: string) {
  if (pathname === "/search") {
    return "Buscar";
  }

  if (pathname.startsWith("/library")) {
    return "Biblioteca";
  }

  if (pathname.startsWith("/lives")) {
    return "En vivo";
  }

  if (pathname.startsWith("/artist")) {
    return "Centro de artista";
  }

  if (pathname.startsWith("/admin")) {
    return "Administracion";
  }

  if (pathname.startsWith("/settings")) {
    return "Ajustes";
  }

  return "StreamButed";
}

export function ResponsiveAppShell({
  brandTarget,
  brandSubtitle,
  children,
  isMobile,
  isSidebarCollapsed,
  mobileMenuOpen,
  mobileProfile,
  mobileSidebar,
  onCloseMobileMenu,
  onOpenMobileMenu,
  showMobileMenuButton = true,
  sidebar,
}: ResponsiveAppShellProps) {
  const location = useLocation();

  useEffect(() => {
    onCloseMobileMenu();
  }, [location.pathname, onCloseMobileMenu]);

  if (!isMobile) {
    return (
      <div className={`app-body${isSidebarCollapsed ? " sidebar-is-collapsed" : ""}`}>
        {sidebar}
        <div className="main-content">{children}</div>
      </div>
    );
  }

  const mobileTitle = getMobileTitle(location.pathname);

  return (
    <>
      <div className="mobile-shell">
        <header className="mobile-topbar">
          {showMobileMenuButton ? (
            <button
              aria-label="Abrir menu"
              className="mobile-menu-button"
              onClick={onOpenMobileMenu}
              type="button"
            >
              <IcMenu />
            </button>
          ) : null}
          <div className="mobile-brand" aria-label={mobileTitle}>
            <div className="mobile-brand-mark">S</div>
            <div className="mobile-brand-copy">
              <div className="mobile-brand-title">{mobileTitle}</div>
              {brandSubtitle ? (
                <div className="mobile-brand-subtitle">{brandSubtitle}</div>
              ) : null}
            </div>
          </div>
          {mobileProfile ? <div className="mobile-profile-slot">{mobileProfile}</div> : null}
        </header>
        <div className="main-content mobile-main-content">{children}</div>
      </div>

      {mobileMenuOpen && mobileSidebar ? (
        <div
          className="mobile-drawer-backdrop"
          onClick={onCloseMobileMenu}
        >
          <aside
            aria-label="Menu de navegacion"
            className="mobile-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-drawer-header">
              <div>
                <div className="mobile-drawer-title">StreamButed</div>
                <div className="mobile-drawer-subtitle">{brandSubtitle}</div>
              </div>
              <button
                aria-label="Cerrar menu"
                className="mobile-menu-button"
                onClick={onCloseMobileMenu}
                type="button"
              >
                <IcX />
              </button>
            </div>
            <div className="mobile-drawer-body">{mobileSidebar}</div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

type MobileTabBarProps = Readonly<{
  items: readonly MobileNavItem[];
}>;

export function MobileTabBar({ items }: MobileTabBarProps) {
  return (
    <nav aria-label="Navegacion principal" className="mobile-tabbar">
      {items.map((item) => (
        <NavLink
          key={item.to}
          className={({ isActive }) => `mobile-tabbar-link${isActive ? " active" : ""}`}
          end={item.end}
          to={item.to}
        >
          <span className="mobile-tabbar-icon">{item.icon}</span>
          <span className="mobile-tabbar-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
