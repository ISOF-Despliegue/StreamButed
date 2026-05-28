import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ResponsiveAppShell, MobileTabBar } from "./ResponsiveAppShell";

describe("ResponsiveAppShell", () => {
  it("renders the mobile header, drawer, and bottom navigation", async () => {
    const browserUser = userEvent.setup();
    const onCloseMobileMenu = jest.fn();
    const onOpenMobileMenu = jest.fn();

    render(
      <MemoryRouter initialEntries={["/search"]}>
        <ResponsiveAppShell
          brandTarget="/search"
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
});
