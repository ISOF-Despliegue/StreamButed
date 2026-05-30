import { ApiError, SESSION_TERMINATED_EVENT, apiRequest, buildApiUrl } from "./apiClient";
import { authTokenStore } from "./authTokenStore";

describe("apiClient", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    authTokenStore.clear();
    globalThis.fetch = jest.fn();
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("builds gateway URLs on /api/v1", () => {
    expect(buildApiUrl("/auth/login")).toBe("http://localhost/api/v1/auth/login");
  });

  it("does not duplicate the /api prefix when VITE_API_BASE_URL already ends with /api", () => {
    expect(buildApiUrl("/auth/login")).not.toContain("/api/api/v1/");
  });

  it("rejects absolute or unsafe API paths", () => {
    expect(() => buildApiUrl("https://evil.example/auth/login")).toThrow(
      "API path must be relative"
    );
    expect(() => buildApiUrl("//evil.example/auth/login")).toThrow("API path must be relative");
    expect(() => buildApiUrl("/catalog/../auth/login")).toThrow(
      "API path contains unsafe path traversal segments."
    );
  });

  it("sends credentials and bearer token", async () => {
    authTokenStore.setAccessToken("access-token");
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await apiRequest("/users/me");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/users/me",
      expect.objectContaining({
        credentials: "include",
        headers: expect.any(Headers),
      })
    );

    const headers = (globalThis.fetch as jest.Mock).mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token");
  });

  it("throws typed ApiError on failed responses", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ message: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(apiRequest("/users/me")).rejects.toBeInstanceOf(ApiError);
  });

  it("translates common backend error messages before throwing", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ message: "Invalid email or password" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(apiRequest("/auth/login", { method: "POST" })).rejects.toMatchObject({
      message: "El correo o la contraseña son incorrectos.",
    });
  });

  it("refreshes an expired access token and retries the original request once", async () => {
    authTokenStore.setAccessToken("old-token");
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Expirado" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "new-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await expect(apiRequest("/users/me")).resolves.toEqual({ ok: true });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    expect((globalThis.fetch as jest.Mock).mock.calls[1][0]).toBe(
      "http://localhost/api/v1/auth/refresh"
    );
    const retryHeaders = (globalThis.fetch as jest.Mock).mock.calls[2][1].headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer new-token");
    expect(authTokenStore.getAccessToken()).toBe("new-token");
  });

  it("refreshes once after a 403 and retries the original request", async () => {
    authTokenStore.setAccessToken("listener-token");
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "No tienes permisos para esta acción." }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "artist-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await expect(apiRequest("/catalog/artists/artist-1")).resolves.toEqual({ ok: true });

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    const retryHeaders = (globalThis.fetch as jest.Mock).mock.calls[2][1].headers as Headers;
    expect(retryHeaders.get("Authorization")).toBe("Bearer artist-token");
    expect(authTokenStore.getAccessToken()).toBe("artist-token");
  });

  it("clears the session and skips refresh when the account is suspended", async () => {
    const sessionTerminatedListener = jest.fn();
    window.addEventListener(SESSION_TERMINATED_EVENT, sessionTerminatedListener);
    authTokenStore.setAccessToken("listener-token");
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({
        error: "AccountBannedException",
        code: "ACCOUNT_BANNED",
        message: "La cuenta se encuentra suspendida.",
        banType: "TEMPORARY",
        bannedUntil: "2026-05-22T13:00:00Z",
        remainingSeconds: 600,
      }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(apiRequest("/users/me")).rejects.toMatchObject({
      status: 403,
      message: "La cuenta se encuentra suspendida.",
      details: expect.objectContaining({
        code: "ACCOUNT_BANNED",
      }),
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(authTokenStore.getAccessToken()).toBeNull();
    expect(sessionTerminatedListener).toHaveBeenCalledTimes(1);
    window.removeEventListener(SESSION_TERMINATED_EVENT, sessionTerminatedListener);
  });

  it("uses the retried response body after refresh instead of stale forbidden details", async () => {
    authTokenStore.setAccessToken("listener-token");
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "No tienes permisos para esta acción." }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "artist-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Acceso denegado al recurso final." }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        })
      );

    await expect(apiRequest("/catalog/artists/artist-1")).rejects.toMatchObject({
      status: 403,
      message: "Acceso denegado al recurso final.",
      details: expect.objectContaining({
        message: "Acceso denegado al recurso final.",
      }),
    });
  });

  it("returns undefined for successful responses without JSON bodies", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(null, { status: 204 })
    );

    await expect(apiRequest("/playback/progress/track-1")).resolves.toBeUndefined();
  });

  it("returns undefined for successful non-json responses", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response("ok", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    );

    await expect(apiRequest("/health")).resolves.toBeUndefined();
  });

  it("wraps network failures before receiving an API response", async () => {
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error("offline"));

    await expect(apiRequest("/users/me")).rejects.toThrow("No se pudo conectar");
  });

  it("wraps network failures after a successful token refresh", async () => {
    authTokenStore.setAccessToken("old-token");
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Expirado" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "new-token" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockRejectedValueOnce(new Error("offline"));

    await expect(apiRequest("/users/me")).rejects.toThrow("No se pudo conectar");
  });

  it("clears the token when refresh responds without a usable access token", async () => {
    authTokenStore.setAccessToken("old-token");
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Expirado" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: null }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    await expect(apiRequest("/users/me")).rejects.toMatchObject({
      message: "La sesión expiró. Inicia sesión nuevamente.",
    });
  });

  it("clears the token when the refresh request fails", async () => {
    authTokenStore.setAccessToken("old-token");
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Expirado" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockRejectedValueOnce(new Error("offline-refresh"));

    await expect(apiRequest("/users/me")).rejects.toMatchObject({
      message: "La sesión expiró. Inicia sesión nuevamente.",
    });
  });

  it("uses text error bodies when the API does not send JSON", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response("Service down", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      })
    );

    await expect(apiRequest("/catalog/search")).rejects.toMatchObject({
      details: { message: "Service down" },
    });
  });

  it("falls back cleanly when JSON error parsing fails", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response("{bad json", {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(apiRequest("/catalog/search")).rejects.toMatchObject({
      message: "No se pudo completar la solicitud.",
    });
  });

  it("falls back cleanly when text error parsing fails", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ "Content-Type": "text/plain" }),
      text: jest.fn().mockRejectedValue(new Error("cannot read body")),
    });

    await expect(apiRequest("/catalog/search")).rejects.toMatchObject({
      details: null,
    });
  });

  it("terminates the session from nested banned error details", async () => {
    const sessionTerminatedListener = jest.fn();
    window.addEventListener(SESSION_TERMINATED_EVENT, sessionTerminatedListener);
    authTokenStore.setAccessToken("listener-token");
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({
        message: "Cuenta suspendida",
        details: {
          error: "AccountBannedException",
          code: "ACCOUNT_BANNED",
          message: "Cuenta suspendida desde details",
        },
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(apiRequest("/users/me")).rejects.toMatchObject({
      details: expect.objectContaining({ code: "ACCOUNT_BANNED" }),
    });
    window.removeEventListener(SESSION_TERMINATED_EVENT, sessionTerminatedListener);
  });

  it("uses backend error fields when no message is provided", async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(apiRequest("/admin")).rejects.toMatchObject({
      message: "No tienes permisos para esta acción.",
    });
  });
});
