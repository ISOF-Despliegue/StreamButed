function normalizeMessage(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function toUserFacingMessage(message: string | null | undefined): string {
  const fallback = "No se pudo completar la solicitud.";
  if (!message) return fallback;

  const normalized = normalizeMessage(message);

  if (
    normalized.includes("invalid email or password") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("bad credentials")
  ) {
    return "El correo o la contraseña son incorrectos.";
  }

  if (
    normalized.includes("verification code is incorrect") ||
    normalized.includes("verification code invalid") ||
    normalized.includes("codigo de verificacion es incorrecto")
  ) {
    return "El código de verificación es incorrecto.";
  }

  if (normalized.includes("verification code has expired")) {
    return "El código de verificación expiró. Solicita uno nuevo.";
  }

  if (normalized.includes("verification code must contain 6 digits")) {
    return "El código debe tener 6 dígitos.";
  }

  if (normalized.includes("verification attempt id is required")) {
    return "No se pudo validar la verificación. Solicita un nuevo código.";
  }

  if (normalized.includes("email must be a valid address")) {
    return "Correo inválido.";
  }

  if (normalized.includes("email must not exceed 320 characters")) {
    return "El correo no puede superar 320 caracteres.";
  }

  if (
    normalized.includes("username must be between 3 and 100 characters") ||
    normalized.includes("username must be between 3 and 50 characters")
  ) {
    return "El nombre de usuario debe tener entre 3 y 100 caracteres.";
  }

  if (normalized.includes("password must be between 8 and 15 characters")) {
    return "La contraseña debe tener entre 8 y 15 caracteres.";
  }

  if (normalized.includes("password confirmation must be between 8 and 15 characters")) {
    return "La confirmación de contraseña debe tener entre 8 y 15 caracteres.";
  }

  if (normalized.includes("must not be blank") || normalized.includes("is required")) {
    return "Todos los campos son obligatorios.";
  }

  if (normalized.includes("password confirmation does not match")) {
    return "Las contraseñas no coinciden.";
  }

  if (normalized.includes("password must contain at least one uppercase letter")) {
    return "La contraseña debe incluir al menos una mayúscula.";
  }

  if (normalized.includes("password must contain at least one number")) {
    return "La contraseña debe incluir al menos un número.";
  }

  if (normalized.includes("password must contain at least one special character")) {
    return "La contraseña debe incluir al menos un símbolo especial.";
  }

  if (
    normalized.includes("email is already registered") ||
    normalized.includes("email already exists")
  ) {
    return "Ese correo ya está registrado. Inicia sesión o usa otro correo.";
  }

  if (
    normalized.includes("username is already in use") ||
    normalized.includes("username already exists")
  ) {
    return "Ese nombre de usuario ya está en uso. Elige otro.";
  }

  if (normalized.includes("registration cannot be completed")) {
    return "No se pudo completar el registro con esos datos.";
  }

  if (normalized.includes("refresh token is invalid")) {
    return "La sesión expiró. Inicia sesión nuevamente.";
  }

  if (normalized.includes("session refresh failed")) {
    return "No pudimos actualizar tu sesión. Inicia sesión nuevamente.";
  }

  if (normalized.includes("access denied") || normalized.includes("forbidden")) {
    return "No tienes permisos para esta accion.";
  }

  if (
    normalized.includes("you already have a playlist with that name") ||
    normalized.includes("playlistnamealreadyexists")
  ) {
    return "Ya existe una playlist con ese nombre.";
  }

  if (
    normalized.includes("this song is already in that playlist") ||
    normalized.includes("trackalreadyinplaylist")
  ) {
    return "Esta canción ya se encuentra en esa playlist.";
  }

  if (normalized.includes("not found")) {
    return "No encontramos la información solicitada.";
  }

  return message;
}
