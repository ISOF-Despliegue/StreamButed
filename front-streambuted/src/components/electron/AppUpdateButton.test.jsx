import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppUpdateButton } from "./AppUpdateButton";

function setUpdatesApi(api) {
  window.streambuted = {
    ...(window.streambuted ?? {}),
    updates: api,
  };
}

describe("AppUpdateButton", () => {
  afterEach(() => {
    delete window.streambuted;
    jest.clearAllMocks();
  });

  it("renders nothing when updates are unavailable", () => {
    render(<AppUpdateButton />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the latest check result after requesting updates", async () => {
    const user = userEvent.setup();
    setUpdatesApi({
      check: jest.fn().mockResolvedValue({ state: "idle", message: "Ya tienes la ultima version" }),
      install: jest.fn(),
      onStatus: jest.fn(() => () => {}),
    });

    render(<AppUpdateButton />);
    await user.click(screen.getByRole("button", { name: "Buscar actualizaciones" }));

    expect(await screen.findByText("Ya tienes la ultima version")).toBeInTheDocument();
  });

  it("installs a downloaded update when requested", async () => {
    const user = userEvent.setup();
    const install = jest.fn().mockResolvedValue(undefined);
    setUpdatesApi({
      check: jest.fn(),
      install,
      onStatus: jest.fn((listener) => {
        listener({ state: "downloaded", message: "Lista para instalar" });
        return () => {};
      }),
    });

    render(<AppUpdateButton />);
    await user.click(await screen.findByRole("button", { name: "Reiniciar e instalar" }));

    expect(install).toHaveBeenCalledTimes(1);
  });

  it("shows an alert when installation fails", async () => {
    const user = userEvent.setup();
    setUpdatesApi({
      check: jest.fn(),
      install: jest.fn().mockRejectedValue(new Error("Instalacion fallida")),
      onStatus: jest.fn((listener) => {
        listener({ state: "downloaded", message: "Lista para instalar" });
        return () => {};
      }),
    });

    render(<AppUpdateButton />);
    await user.click(await screen.findByRole("button", { name: "Reiniciar e instalar" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Instalacion fallida");
    });
  });
});
