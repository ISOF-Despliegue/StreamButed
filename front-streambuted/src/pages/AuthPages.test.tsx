import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GooglePasswordSetupPage, LoginPage, RegisterPage } from "./AuthPages";

describe("LoginPage", () => {
  it("renders the login form", () => {
    render(<LoginPage onLogin={jest.fn()} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    expect(screen.getByText("Bienvenido a StreamButed")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ingresa tu correo")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ingresa tu contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
  });

  it("allows switching to register", async () => {
    const user = userEvent.setup();
    const onRegister = jest.fn();

    render(<LoginPage onLogin={jest.fn()} onRegister={onRegister} onGoogleLogin={jest.fn()} />);

    await user.click(screen.getByText("Regístrate"));

    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it("submits login credentials", async () => {
    const user = userEvent.setup();
    const onLogin = jest.fn().mockResolvedValue(undefined);

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "listener@example.com");
    await user.type(screen.getByPlaceholderText("Ingresa tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(onLogin).toHaveBeenCalledWith({
      email: "listener@example.com",
      password: "SecurePass1!",
    });
  });

  it("validates login email and password fields before submitting", async () => {
    const user = userEvent.setup();
    const onLogin = jest.fn();

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Correo requerido.");

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "invalid-email");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Correo inválido.");
    expect(onLogin).not.toHaveBeenCalled();
  });

  it("shows backend login errors", async () => {
    const user = userEvent.setup();
    const onLogin = jest.fn().mockRejectedValue(new Error("Credenciales inválidas."));

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "listener@example.com");
    await user.type(screen.getByPlaceholderText("Ingresa tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales inválidas.");
  });

  it("shows banned account errors in an app dialog", async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error("La cuenta se encuentra suspendida."), {
      details: {
        code: "ACCOUNT_BANNED",
        banType: "TEMPORARY",
        bannedUntil: "2026-05-20T13:00:00Z",
        remainingSeconds: 3660,
      },
    });
    const onLogin = jest.fn().mockRejectedValue(error);

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "listener@example.com");
    await user.type(screen.getByPlaceholderText("Ingresa tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Cuenta suspendida");
    expect(screen.getByRole("dialog")).toHaveTextContent("1 hora y 1 minuto");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("explains permanent account bans in the app dialog", async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error("La cuenta se encuentra suspendida."), {
      details: {
        code: "ACCOUNT_BANNED",
        banType: "PERMANENT",
      },
    });
    const onLogin = jest.fn().mockRejectedValue(error);

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "listener@example.com");
    await user.type(screen.getByPlaceholderText("Ingresa tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent(
      "La cuenta se encuentra suspendida permanentemente."
    );
  });

  it("formats multi-day temporary bans", async () => {
    const user = userEvent.setup();
    const error = Object.assign(new Error("La cuenta se encuentra suspendida."), {
      details: {
        code: "ACCOUNT_BANNED",
        banType: "TEMPORARY",
        bannedUntil: "2026-05-22T13:00:00Z",
        remainingSeconds: 90000,
      },
    });
    const onLogin = jest.fn().mockRejectedValue(error);

    render(<LoginPage onLogin={onLogin} onRegister={jest.fn()} onGoogleLogin={jest.fn()} />);

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "listener@example.com");
    await user.type(screen.getByPlaceholderText("Ingresa tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("1 día y 1 hora");
  });

  it("starts Google login", async () => {
    const user = userEvent.setup();
    const onGoogleLogin = jest.fn();

    render(<LoginPage onLogin={jest.fn()} onRegister={jest.fn()} onGoogleLogin={onGoogleLogin} />);

    await user.click(screen.getByRole("button", { name: "Continuar con Google" }));

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
        onBack={jest.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Registrarse con Google" })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Elige un nombre de usuario"), "newuser");
    await user.type(screen.getByPlaceholderText("Crea una contraseña"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(onStartRegistration).toHaveBeenCalledWith({
      email: "new@example.com",
      username: "newuser",
      password: "SecurePass1!",
    });
    expect(await screen.findByLabelText("Código de verificación")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Código enviado a new@example.com. Expira en 15 minutos."
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
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Elige un nombre de usuario"), "newuser");
    await user.type(screen.getByPlaceholderText("Crea una contraseña"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await user.type(await screen.findByLabelText("Código de verificación"), "123456");
    await user.click(screen.getByRole("button", { name: "Verificar código" }));

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
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Elige un nombre de usuario"), "newuser");
    await user.type(screen.getByPlaceholderText("Crea una contraseña"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await user.click(await screen.findByRole("button", { name: "Solicitar nuevo código" }));

    expect(onResendCode).toHaveBeenCalledWith({
      attemptId: "attempt-1",
      email: "new@example.com",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Nuevo código enviado a new@example.com. Expira en 15 minutos."
    );

    await user.click(screen.getByRole("button", { name: "Cancelar verificación" }));

    expect(onCancelVerification).toHaveBeenCalledWith({
      attemptId: "attempt-2",
      email: "new@example.com",
    });
    expect(await screen.findByText("Verificación cancelada.")).toBeInTheDocument();
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
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Elige un nombre de usuario"), "newuser");
    await user.type(screen.getByPlaceholderText("Crea una contraseña"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Código enviado a new@example.com. Expira en 2 minutos."
    );

    await user.click(screen.getByRole("button", { name: "Solicitar nuevo código" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Nuevo código enviado a new@example.com. Expira en 1 minuto."
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
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Elige un nombre de usuario"), "newuser");
    await user.type(screen.getByPlaceholderText("Crea una contraseña"), "securepass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "securepass1!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La contraseña debe incluir al menos una mayúscula."
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
        onBack={jest.fn()}
      />
    );

    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Todos los campos son requeridos.");

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Elige un nombre de usuario"), "ab");
    await user.type(screen.getByPlaceholderText("Crea una contraseña"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El nombre de usuario debe tener entre 3 y 50 caracteres."
    );

    onStartRegistration.mockResolvedValueOnce({
      attemptId: "attempt-1",
      email: "new@example.com",
      status: "pending",
      expiresInSeconds: 900,
      message: "Verification code sent.",
    });

    await user.clear(screen.getByPlaceholderText("Elige un nombre de usuario"));
    await user.type(screen.getByPlaceholderText("Elige un nombre de usuario"), "newuser");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await user.type(await screen.findByLabelText("Código de verificación"), "123");
    await user.click(screen.getByRole("button", { name: "Verificar código" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ingresa el código de 6 dígitos.");
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
        onBack={jest.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText("Ingresa tu correo"), "new@example.com");
    await user.type(screen.getByPlaceholderText("Elige un nombre de usuario"), "newuser");
    await user.type(screen.getByPlaceholderText("Crea una contraseña"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Crear cuenta" }));

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

    await user.type(screen.getByPlaceholderText("Crea tu contraseña"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

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

    await user.type(screen.getByPlaceholderText("Crea tu contraseña"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "SecurePass2!");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Las contraseñas no coinciden.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("validates required fields and surfaces backend setup errors", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn().mockRejectedValue(new Error("No se pudo guardar la contraseña."));

    render(<GooglePasswordSetupPage email="google@example.com" onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Completa ambos campos de contraseña."
    );

    await user.type(screen.getByPlaceholderText("Crea tu contraseña"), "SecurePass1!");
    await user.type(screen.getByPlaceholderText("Confirma tu contraseña"), "SecurePass1!");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo guardar la contraseña."
    );
  });
});
