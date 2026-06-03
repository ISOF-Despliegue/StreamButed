import { toUserFacingMessage } from "./userFacingMessages";

describe("toUserFacingMessage", () => {
  it("translates common backend validation and auth messages", () => {
    const messages = [
      "Invalid credentials",
      "verification code invalid",
      "verification code has expired",
      "verification code must contain 6 digits",
      "verification attempt id is required",
      "email must be a valid address",
      "email must not exceed 320 characters",
      "username must be between 3 and 50 characters",
      "password must be between 8 and 15 characters",
      "password confirmation must be between 8 and 15 characters",
      "name is required",
      "password confirmation does not match",
      "password must contain at least one uppercase letter",
      "password must contain at least one number",
      "password must contain at least one special character",
      "email already exists",
      "username already exists",
      "registration cannot be completed",
      "refresh token is invalid",
      "session refresh failed",
      "forbidden",
      "playlistNameAlreadyExists",
      "trackAlreadyInPlaylist",
      "artist not found",
      "custom backend message",
    ];

    expect(messages.map((message) => toUserFacingMessage(message))).toEqual([
      "El correo o la contraseña son incorrectos.",
      "El código de verificación es incorrecto.",
      "El código de verificación expiró. Solicita uno nuevo.",
      "El código debe tener 6 dígitos.",
      "No se pudo validar la verificación. Solicita un nuevo código.",
      "Correo inválido.",
      "El correo no puede superar 320 caracteres.",
      "El nombre de usuario debe tener entre 3 y 100 caracteres.",
      "La contraseña debe tener entre 8 y 15 caracteres.",
      "La confirmación de contraseña debe tener entre 8 y 15 caracteres.",
      "Todos los campos son obligatorios.",
      "Las contraseñas no coinciden.",
      "La contraseña debe incluir al menos una mayúscula.",
      "La contraseña debe incluir al menos un número.",
      "La contraseña debe incluir al menos un símbolo especial.",
      "Ese correo ya está registrado. Inicia sesión o usa otro correo.",
      "Ese nombre de usuario ya está en uso. Elige otro.",
      "No se pudo completar el registro con esos datos.",
      "Tu sesión expiró. Inicia sesión nuevamente.",
      "No pudimos actualizar tu sesión. Inicia sesión nuevamente.",
      "No tienes permisos para esta acción.",
      "Ya existe una playlist con ese nombre.",
      "Esta canción ya se encuentra en esa playlist.",
      "No encontramos la información solicitada.",
      "custom backend message",
    ]);
  });

  it("uses the fallback message for blank backend errors", () => {
    expect(toUserFacingMessage(null)).toBe("No se pudo completar la solicitud.");
  });
});
