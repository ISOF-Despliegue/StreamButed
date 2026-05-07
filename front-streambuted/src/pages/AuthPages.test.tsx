import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginPage, RegisterPage } from "./AuthPages";

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(<LoginPage onLogin={jest.fn()} onRegister={jest.fn()} />);

    expect(screen.getByText("Welcome to StreamButed")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("allows switching to register", async () => {
    const user = userEvent.setup();
    const onRegister = jest.fn();

    render(<LoginPage onLogin={jest.fn()} onRegister={onRegister} />);

    await user.click(screen.getByText("Sign up"));

    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it("submits login credentials", async () => {
    const user = userEvent.setup();
    const onLogin = jest.fn().mockResolvedValue(undefined);

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "listener@example.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(onLogin).toHaveBeenCalledWith({
      email: "listener@example.com",
      password: "SecurePass1!",
    });
  });
});

describe("RegisterPage", () => {
  it("submits register data", async () => {
    const user = userEvent.setup();
    const onRegister = jest.fn().mockResolvedValue(undefined);

    render(<RegisterPage onRegister={onRegister} onBack={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Choose a username"), "newuser");
    await user.type(screen.getByPlaceholderText("Create a password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirm your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(onRegister).toHaveBeenCalledWith({
      email: "new@example.com",
      username: "newuser",
      password: "SecurePass1!",
    });
  });
});
