import { ApiError, apiRequest, buildApiUrl } from "./apiClient";
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
});
