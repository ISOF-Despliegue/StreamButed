import "@testing-library/jest-dom";

Object.defineProperty(globalThis, "__importMeta", {
  value: {
    env: {
      VITE_API_BASE_URL: "http://localhost",
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
