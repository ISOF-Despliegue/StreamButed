import {
  APP_ORIGIN,
  buildRendererContentSecurityPolicy,
  isAllowedExternalUrl,
  isAllowedPermissionRequest,
  isAllowedRendererNavigation,
  validateDeepLinkCallback,
} from "./security";

describe("Electron security helpers", () => {
  it("allows only HTTPS URLs for trusted external hosts", () => {
    expect(isAllowedExternalUrl("https://migueleelg0106.me/desktop-auth/start")).toBe(true);
    expect(isAllowedExternalUrl("https://api.migueleelg0106.me/docs")).toBe(true);
    expect(isAllowedExternalUrl("https://accounts.google.com/o/oauth2/v2/auth")).toBe(true);

    expect(isAllowedExternalUrl("http://migueleelg0106.me")).toBe(false);
    expect(isAllowedExternalUrl("file:///C:/Windows/System32/calc.exe")).toBe(false);
    expect(isAllowedExternalUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedExternalUrl("streambuted://auth/callback")).toBe(false);
    expect(isAllowedExternalUrl("https://evil.example/login")).toBe(false);
    expect(isAllowedExternalUrl("not a url")).toBe(false);
  });

  it("allows HTTP localhost external URLs only for development mode", () => {
    expect(isAllowedExternalUrl("http://localhost:5173/desktop-auth/start")).toBe(false);
    expect(isAllowedExternalUrl("http://localhost:5173/desktop-auth/start", undefined, true)).toBe(true);
    expect(isAllowedExternalUrl("http://evil.example/desktop-auth/start", undefined, true)).toBe(false);
  });

  it("blocks BrowserWindow navigation outside the packaged app origin", () => {
    expect(isAllowedRendererNavigation("app://streambuted/index.html")).toBe(true);
    expect(isAllowedRendererNavigation("app://streambuted/library")).toBe(true);

    expect(isAllowedRendererNavigation("https://migueleelg0106.me")).toBe(false);
    expect(isAllowedRendererNavigation("file:///tmp/index.html")).toBe(false);
    expect(isAllowedRendererNavigation("javascript:alert(1)")).toBe(false);
  });

  it("allows dev-server navigation only when explicitly provided", () => {
    expect(isAllowedRendererNavigation("http://localhost:5173", APP_ORIGIN, "http://localhost:5173")).toBe(true);
    expect(isAllowedRendererNavigation("http://localhost:5174", APP_ORIGIN, "http://localhost:5173")).toBe(false);
  });

  it("denies permissions by default and only allows media capture from app origin", () => {
    expect(isAllowedPermissionRequest(APP_ORIGIN, "media")).toBe(true);
    expect(isAllowedPermissionRequest(APP_ORIGIN, "audioCapture")).toBe(true);
    expect(isAllowedPermissionRequest(APP_ORIGIN, "videoCapture")).toBe(true);

    expect(isAllowedPermissionRequest(APP_ORIGIN, "geolocation")).toBe(false);
    expect(isAllowedPermissionRequest("https://migueleelg0106.me", "media")).toBe(false);
  });

  it("validates deep link callback shape before exchange", () => {
    expect(validateDeepLinkCallback("streambuted://auth/callback?code=abc&state=state-123")).toEqual({
      valid: true,
      code: "abc",
      state: "state-123",
    });

    expect(validateDeepLinkCallback("streambuted://evil/callback?code=abc&state=state-123")).toEqual({
      valid: false,
    });
    expect(validateDeepLinkCallback("streambuted://auth/callback?code=&state=state-123")).toEqual({
      valid: false,
    });
  });

  it("builds a renderer CSP without unsafe-eval or open connect sources", () => {
    const csp = buildRendererContentSecurityPolicy("https://api.migueleelg0106.me/api");

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' https://api.migueleelg0106.me wss://api.migueleelg0106.me");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toContain("*");
  });
});
