import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GooglePasswordSetupPage, LoginPage, RegisterPage } from "./AuthPages";

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(<LoginPage onLogin={jest.fn()} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    expect(screen.getByText("Welcome to StreamButed")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("allows switching to register", async () => {
    const user = userEvent.setup();
    const onRegister = jest.fn();

    render(<LoginPage onLogin={jest.fn()} onRegister={onRegister} onGoogleLogin={jest.fn()} />);

    await user.click(screen.getByText("Sign up"));

    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it("submits login credentials", async () => {
    const user = userEvent.setup();
    const onLogin = jest.fn().mockResolvedValue(undefined);

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "listener@example.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(onLogin).toHaveBeenCalledWith({
      email: "listener@example.com",
      password: "SecurePass1!",
    });
  });

  it("validates login email and password fields before submitting", async () => {
    const user = userEvent.setup();
    const onLogin = jest.fn();

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email requerido.");

    await user.type(screen.getByPlaceholderText("Enter your email"), "invalid-email");
    await user.click(screen.getByRole("button", { name: "Sign In" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email invalido.");
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("shows backend login errors", async () => {
    const user = userEvent.setup();
    const onLogin = jest.fn().mockRejectedValue(new Error("Credenciales invalidas."));

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("Enter your email"), "listener@example.com");
    await user.type(screen.getByPlaceholderText("Enter your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales invalidas.");
  });

  it("starts Google login", async () => {
    const user = userEvent.setup();
    const onGoogleLogin = jest.fn();

    render(<LoginPage onLogin={jest.fn()} onRegister={jest.fn()} onGoogleLogin={onGoogleLogin} />);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(onGoogleLogin).toHaveBeenCalledTimes(1);
  });
});

describe("RegisterPage", () => {
  it("requests a verification code with register data", async () => {
    const user = userEvent.setup();
    const onStartRegistration = jest.fn().mockResolvedValue({
      attemptId: "attempt-1",
      email: "new@example.com",
      status: "pending",
      expiresInSeconds: 900,
      message: "Verification code sent.",
    });

    render(
      <RegisterPage
        onStartRegistration={onStartRegistration}
        onVerifyRegistration={jest.fn()}
        onResendCode={jest.fn()}
        onCancelVerification={jest.fn()}
        onGoogleRegister={jest.fn()}
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Enter your email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Choose a username"), "newuser");
    await user.type(screen.getByPlaceholderText("Create a password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirm your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(onStartRegistration).toHaveBeenCalledWith({
      email: "new@example.com",
      username: "newuser",
      password: "SecurePass1!",
    });
    expect(await screen.findByLabelText("Codigo de verificacion")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Codigo enviado a new@example.com. Expira en 15 minutos."
    );
  });

  it("verifies the code before completing registration", async () => {
    const user = userEvent.setup();
    const onVerifyRegistration = jest.fn().mockResolvedValue(undefined);

    render(
      <RegisterPage
        onStartRegistration={jest.fn().mockResolvedValue({
          attemptId: "attempt-1",
          email: "new@example.com",
          status: "pending",
          expiresInSeconds: 900,
          message: "Verification code sent.",
        })}
        onVerifyRegistration={onVerifyRegistration}
        onResendCode={jest.fn()}
        onCancelVerification={jest.fn()}
        onGoogleRegister={jest.fn()}
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Enter your email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Choose a username"), "newuser");
    await user.type(screen.getByPlaceholderText("Create a password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirm your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    await user.type(await screen.findByLabelText("Codigo de verificacion"), "123456");
    await user.click(screen.getByRole("button", { name: "Verificar codigo" }));

    expect(onVerifyRegistration).toHaveBeenCalledWith({
      attemptId: "attempt-1",
      email: "new@example.com",
      code: "123456",
    });
  });

  it("can request a new code and cancel verification", async () => {
    const user = userEvent.setup();
    const onResendCode = jest.fn().mockResolvedValue({
      attemptId: "attempt-2",
      email: "new@example.com",
      status: "pending",
      expiresInSeconds: 900,
      message: "Verification code sent.",
    });
    const onCancelVerification = jest.fn().mockResolvedValue(undefined);

    render(
      <RegisterPage
        onStartRegistration={jest.fn().mockResolvedValue({
          attemptId: "attempt-1",
          email: "new@example.com",
          status: "pending",
          expiresInSeconds: 900,
          message: "Verification code sent.",
        })}
        onVerifyRegistration={jest.fn()}
        onResendCode={onResendCode}
        onCancelVerification={onCancelVerification}
        onGoogleRegister={jest.fn()}
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Enter your email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Choose a username"), "newuser");
    await user.type(screen.getByPlaceholderText("Create a password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirm your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    await user.click(await screen.findByRole("button", { name: "Solicitar nuevo codigo" }));

    expect(onResendCode).toHaveBeenCalledWith({
      attemptId: "attempt-1",
      email: "new@example.com",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Nuevo codigo enviado a new@example.com. Expira en 15 minutos."
    );

    await user.click(screen.getByRole("button", { name: "Cancelar verificacion" }));

    expect(onCancelVerification).toHaveBeenCalledWith({
      attemptId: "attempt-2",
      email: "new@example.com",
    });
    expect(await screen.findByText("Verificacion cancelada.")).toBeInTheDocument();
  });

  it("derives the displayed expiration from the backend ttl", async () => {
    const user = userEvent.setup();

    render(
      <RegisterPage
        onStartRegistration={jest.fn().mockResolvedValue({
          attemptId: "attempt-1",
          email: "new@example.com",
          status: "pending",
          expiresInSeconds: 120,
          message: "Verification code sent.",
        })}
        onVerifyRegistration={jest.fn()}
        onResendCode={jest.fn().mockResolvedValue({
          attemptId: "attempt-2",
          email: "new@example.com",
          status: "pending",
          expiresInSeconds: 60,
          message: "Verification code sent.",
        })}
        onCancelVerification={jest.fn()}
        onGoogleRegister={jest.fn()}
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Enter your email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Choose a username"), "newuser");
    await user.type(screen.getByPlaceholderText("Create a password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirm your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Codigo enviado a new@example.com. Expira en 2 minutos."
    );

    await user.click(screen.getByRole("button", { name: "Solicitar nuevo codigo" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Nuevo codigo enviado a new@example.com. Expira en 1 minuto."
    );
  });

  it("validates password complexity before requesting the code", async () => {
    const user = userEvent.setup();
    const onStartRegistration = jest.fn();

    render(
      <RegisterPage
        onStartRegistration={onStartRegistration}
        onVerifyRegistration={jest.fn()}
        onResendCode={jest.fn()}
        onCancelVerification={jest.fn()}
        onGoogleRegister={jest.fn()}
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Enter your email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Choose a username"), "newuser");
    await user.type(screen.getByPlaceholderText("Create a password"), "securepass1!");
    await user.type(screen.getByPlaceholderText("Confirm your password"), "securepass1!");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El password debe incluir al menos una mayuscula."
    );
    expect(onStartRegistration).not.toHaveBeenCalled();
  });

  it("validates required fields, username length and code format", async () => {
    const user = userEvent.setup();
    const onStartRegistration = jest.fn();
    const onVerifyRegistration = jest.fn();

    render(
      <RegisterPage
        onStartRegistration={onStartRegistration}
        onVerifyRegistration={onVerifyRegistration}
        onResendCode={jest.fn()}
        onCancelVerification={jest.fn()}
        onGoogleRegister={jest.fn()}
        onBack={jest.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Todos los campos son requeridos.");

    await user.type(screen.getByPlaceholderText("Enter your email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Choose a username"), "ab");
    await user.type(screen.getByPlaceholderText("Create a password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirm your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Create Account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El username debe tener entre 3 y 50 caracteres."
    );

    onStartRegistration.mockResolvedValueOnce({
      attemptId: "attempt-1",
      email: "new@example.com",
      status: "pending",
      expiresInSeconds: 900,
      message: "Verification code sent.",
    });

    await user.clear(screen.getByPlaceholderText("Choose a username"));
    await user.type(screen.getByPlaceholderText("Choose a username"), "newuser");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await user.type(await screen.findByLabelText("Codigo de verificacion"), "123");
    await user.click(screen.getByRole("button", { name: "Verificar codigo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ingresa el codigo de 6 digitos.");
    expect(onVerifyRegistration).not.toHaveBeenCalled();
  });

  it("shows registration action errors from the backend", async () => {
    const user = userEvent.setup();
    const onStartRegistration = jest.fn().mockRejectedValue("Fallo inesperado.");

    render(
      <RegisterPage
        onStartRegistration={onStartRegistration}
        onVerifyRegistration={jest.fn()}
        onResendCode={jest.fn()}
        onCancelVerification={jest.fn()}
        onGoogleRegister={jest.fn()}
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Enter your email"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Choose a username"), "newuser");
    await user.type(screen.getByPlaceholderText("Create a password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirm your password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo completar la solicitud."
    );
  });
});

describe("GooglePasswordSetupPage", () => {
  it("submits a valid password setup request", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    render(
      <GooglePasswordSetupPage
        email="google@example.com"
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText("Crea tu password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Guardar password" }));

    expect(onSubmit).toHaveBeenCalledWith({
      password: "SecurePass1!",
      confirmPassword: "SecurePass1!",
    });
  });

  it("shows a mismatch error before submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();

    render(
      <GooglePasswordSetupPage
        email="google@example.com"
        onSubmit={onSubmit}
      />
    );

    await user.type(screen.getByPlaceholderText("Crea tu password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu password"), "SecurePass2!");
    await user.click(screen.getByRole("button", { name: "Guardar password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Los passwords no coinciden.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("validates required fields and surfaces backend setup errors", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockRejectedValue(new Error("No se pudo guardar el password."));

    render(<GooglePasswordSetupPage email="google@example.com" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Guardar password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Completa ambos campos de password."
    );

    await user.type(screen.getByPlaceholderText("Crea tu password"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu password"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Guardar password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo guardar el password."
    );
  });
});
