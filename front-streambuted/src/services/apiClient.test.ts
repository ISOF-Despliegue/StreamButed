import { ApiError, SESSION_TERMINATED_EVENT, apiRequest, buildApiUrl } from "./apiClient";
import { authTokenStore } from "./authTokenStore";

describe("apiClient", () => {
  beforeEach(() => {
    authTokenStore.clear();
    globalThis.fetch = jest.fn();
  });

  it("builds gateway URLs on /api/v1", () => {
    expect(buildApiUrl("/auth/login")).toBe("http://localhost/api/v1/auth/login");
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
});
