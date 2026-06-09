import http from "k6/http";
import { check, group, sleep } from "k6";

const API_BASE_URL = (__ENV.API_BASE_URL || "https://api.migueleelg0106.me").replace(/\/$/, "");
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN;
const AUTH_EMAIL = __ENV.AUTH_EMAIL;
const AUTH_PASSWORD = __ENV.AUTH_PASSWORD;

export const options = {
  vus: 1,
  iterations: 5,
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

export function setup() {
  if (ACCESS_TOKEN) {
    return { token: ACCESS_TOKEN, source: "ACCESS_TOKEN" };
  }

  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    console.warn("Skipping authenticated requests: set ACCESS_TOKEN or AUTH_EMAIL and AUTH_PASSWORD.");
    return { token: null, source: "none" };
  }

  const response = http.post(
    `${API_BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: AUTH_EMAIL, password: AUTH_PASSWORD }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { service: "identity", endpoint: "/api/v1/auth/login" },
    }
  );

  const loginOk = check(response, {
    "login status is 200": (res) => res.status === 200,
    "login returns access token": (res) => Boolean(res.json("accessToken")),
  });

  if (!loginOk) {
    console.warn(`Login failed with status ${response.status}; authenticated requests will be skipped.`);
    return { token: null, source: "login-failed" };
  }

  return { token: response.json("accessToken"), source: "login" };
}

export default function (data) {
  group("public health", () => {
    const response = http.get(`${API_BASE_URL}/api/v1/auth/actuator/health`, {
      tags: { service: "identity", endpoint: "/api/v1/auth/actuator/health" },
    });

    check(response, {
      "identity health is 200": (res) => res.status === 200,
    });
  });

  if (!data.token) {
    sleep(1);
    return;
  }

  const headers = {
    Authorization: `Bearer ${data.token}`,
    "Content-Type": "application/json",
  };

  group("authenticated identity reads", () => {
    const profile = http.get(`${API_BASE_URL}/api/v1/users/me`, {
      headers,
      tags: { service: "identity", endpoint: "/api/v1/users/me" },
    });

    check(profile, {
      "profile status is 200": (res) => res.status === 200,
      "profile response is json": (res) => (res.headers["Content-Type"] || "").includes("application/json"),
    });

    const validation = http.get(`${API_BASE_URL}/api/v1/auth/validate`, {
      headers,
      tags: { service: "identity", endpoint: "/api/v1/auth/validate" },
    });

    check(validation, {
      "token validation status is 200": (res) => res.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);
}
