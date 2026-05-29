import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

Object.defineProperty(globalThis, "TextEncoder", {
  value: TextEncoder,
  configurable: true,
});

Object.defineProperty(globalThis, "TextDecoder", {
  value: TextDecoder,
  configurable: true,
});

Object.defineProperty(globalThis, "__importMeta", {
  value: {
    env: {
      VITE_API_BASE_URL: "http://localhost/api",
      VITE_GATEWAY_URL: "https://api.migueleelg0106.me",
    },
  },
  configurable: true,
});

class TestResponse {
  public readonly status: number;
  public readonly headers: Headers;
  public readonly ok: boolean;

  constructor(private readonly body: string | null = null, init: ResponseInit = {}) {
    this.status = init.status ?? 200;
    this.headers = new Headers(init.headers);
    this.ok = this.status >= 200 && this.status < 300;
  }

  async json(): Promise<unknown> {
    return this.body ? JSON.parse(this.body) : null;
  }

  async text(): Promise<string> {
    return this.body ?? "";
  }
}

Object.defineProperty(globalThis, "Response", {
  value: TestResponse,
  configurable: true,
});
