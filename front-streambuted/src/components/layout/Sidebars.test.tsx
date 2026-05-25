import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { MainSidebar } from "./Sidebars";

const user = {
  id: "artist-1",
  role: "artist",
  username: "Ada",
};

describe("Sidebars", () => {
  it("calls the toggle action from expanded and collapsed states", async () => {
    const browserUser = userEvent.setup();
    const onToggle = jest.fn();
    const { rerender } = render(
      <MemoryRouter>
        <MainSidebar collapsed={false} onToggle={onToggle} user={user} />
      </MemoryRouter>
    );

    await browserUser.click(screen.getByRole("button", { name: "Ocultar barra lateral" }));
    expect(onToggle).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <MainSidebar collapsed onToggle={onToggle} user={user} />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "Mostrar barra lateral" }).closest(".sidebar-collapsed-rail"))
      .not.toBeNull();
    await browserUser.click(screen.getByRole("button", { name: "Mostrar barra lateral" }));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
