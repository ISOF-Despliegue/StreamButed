import http from "k6/http";
import { check, sleep } from "k6";

const API_BASE_URL = (__ENV.API_BASE_URL || "https://api.migueleelg0106.me").replace(/\/$/, "");

const healthEndpoints = [
  "/api/v1/auth/actuator/health",
  "/api/v1/catalog/health",
  "/api/v1/media/health",
  "/api/v1/playback/health",
  "/api/v1/analytics/health",
  "/api/v1/live/health",
];

export const options = {
  vus: 1,
  iterations: 6,
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

export default function () {
  const endpoint = healthEndpoints[__ITER % healthEndpoints.length];
  const response = http.get(`${API_BASE_URL}${endpoint}`, {
    tags: { service: endpoint.split("/")[3], endpoint },
  });

  check(response, {
    "health status is 200": (res) => res.status === 200,
    "health body is present": (res) => Boolean(res.body && res.body.length > 0),
  });

  sleep(1);
}
