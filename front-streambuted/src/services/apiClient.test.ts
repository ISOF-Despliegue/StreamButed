import { ApiError, apiRequest, buildApiUrl } from "./apiClient";
import { authTokenStore } from "./authTokenStore";

describe("apiClient", () => {
  beforeEach(() => {
    authTokenStore.clear();
    global.fetch = jest.fn();
  });

  it("builds gateway URLs on /api/v1", () => {
    expect(buildApiUrl("/auth/login")).toBe("http://localhost/api/v1/auth/login");
  });

  it("sends credentials and bearer token", async () => {
    authTokenStore.setAccessToken("access-token");
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await apiRequest("/users/me");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost/api/v1/users/me",
      expect.objectContaining({
        credentials: "include",
        headers: expect.any(Headers),
      })
    );

    const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token");
  });

  it("throws typed ApiError on failed responses", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      new Response(JSON.stringify({ message: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(apiRequest("/users/me")).rejects.toBeInstanceOf(ApiError);
  });
});
