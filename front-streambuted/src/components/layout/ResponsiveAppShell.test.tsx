import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ResponsiveAppShell, MobileTabBar } from "./ResponsiveAppShell";

describe("ResponsiveAppShell", () => {
  it("renders the desktop shell without mobile controls", () => {
    render(
      <MemoryRouter initialEntries={["/library"]}>
        <ResponsiveAppShell
          brandSubtitle="Desktop"
          isMobile={false}
          isSidebarCollapsed
          mobileMenuOpen={false}
          onCloseMobileMenu={jest.fn()}
          onOpenMobileMenu={jest.fn()}
          sidebar={<div>Sidebar desktop</div>}
        >
          <div>Contenido desktop</div>
        </ResponsiveAppShell>
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Abrir menu" })).toBeNull();
  });

  it("renders the mobile header, drawer, and bottom navigation", async () => {
    const browserUser = userEvent.setup();
    const onCloseMobileMenu = jest.fn();
    const onOpenMobileMenu = jest.fn();

    render(
      <MemoryRouter initialEntries={["/search"]}>
        <ResponsiveAppShell
          brandSubtitle="Artista · Ada"
          isMobile
          isSidebarCollapsed={false}
          mobileMenuOpen
          mobileSidebar={<div>Menu movil</div>}
          onCloseMobileMenu={onCloseMobileMenu}
          onOpenMobileMenu={onOpenMobileMenu}
          sidebar={<div>Menu desktop</div>}
        >
          <Routes>
            <Route path="/search" element={<div>Buscar contenido</div>} />
          </Routes>
        </ResponsiveAppShell>
        <MobileTabBar
          items={[
            { to: "/search", label: "Buscar", icon: <span aria-hidden="true">B</span> },
            { to: "/library", label: "Biblioteca", icon: <span aria-hidden="true">L</span> },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Buscar contenido")).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar")).toBeInTheDocument();
    expect(screen.getAllByText("Artista · Ada")).toHaveLength(2);
    expect(screen.getByText("Menu movil")).toBeInTheDocument();
    const activeSearchLink = screen
      .getAllByRole("link", { name: /buscar/i })
      .find((element) => element.classList.contains("active"));

    expect(activeSearchLink).toHaveClass("active");

    await browserUser.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(onOpenMobileMenu).toHaveBeenCalledTimes(1);
  });

  it("hides the mobile menu button when the shell disables it", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <ResponsiveAppShell
          brandSubtitle="Ajustes"
          isMobile
          isSidebarCollapsed={false}
          mobileMenuOpen={false}
          mobileProfile={<div>Perfil</div>}
          onCloseMobileMenu={jest.fn()}
          onOpenMobileMenu={jest.fn()}
          showMobileMenuButton={false}
          sidebar={<div>Sidebar</div>}
        >
          <div>Contenido movil</div>
        </ResponsiveAppShell>
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: "Abrir menu" })).toBeNull();
  });
});
