import http from "k6/http";
import { check, group, sleep } from "k6";

const API_BASE_URL = (__ENV.API_BASE_URL || "https://api.migueleelg0106.me").replace(/\/$/, "");
const FRONTEND_URL = (__ENV.FRONTEND_URL || "https://migueleelg0106.me").replace(/\/$/, "");
const SEARCH_TERMS = (__ENV.CATALOG_SEARCH_TERMS || "a,music,rock,pop").split(",").map((term) => term.trim()).filter(Boolean);

const healthEndpoints = [
  "/api/v1/auth/actuator/health",
  "/api/v1/catalog/health",
  "/api/v1/media/health",
  "/api/v1/playback/health",
  "/api/v1/analytics/health",
  "/api/v1/live/health",
];

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 20 },
    { duration: "1m", target: 30 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  group("frontend entry", () => {
    const response = http.get(FRONTEND_URL, {
      tags: { service: "frontend", endpoint: "/" },
    });

    check(response, {
      "frontend responds": (res) => res.status >= 200 && res.status < 400,
    });
  });

  sleep(Math.random() * 2 + 1);

  group("service health checks", () => {
    for (const endpoint of healthEndpoints) {
      const response = http.get(`${API_BASE_URL}${endpoint}`, {
        tags: { service: endpoint.split("/")[3], endpoint },
      });

      check(response, {
        [`${endpoint} status is 200`]: (res) => res.status === 200,
      });
    }
  });

  sleep(Math.random() * 2 + 1);

  group("catalog browsing", () => {
    const searchTerm = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)] || "a";
    const response = http.get(
      `${API_BASE_URL}/api/v1/catalog/search?searchTerm=${encodeURIComponent(searchTerm)}&limit=10&offset=0`,
      { tags: { service: "catalog", endpoint: "/api/v1/catalog/search" } }
    );

    check(response, {
      "catalog search status is 200": (res) => res.status === 200,
    });
  });

  sleep(Math.random() * 3 + 2);

  group("media and playback readiness", () => {
    const media = http.get(`${API_BASE_URL}/api/v1/media/health`, {
      tags: { service: "media", endpoint: "/api/v1/media/health" },
    });
    const playback = http.get(`${API_BASE_URL}/api/v1/playback/health`, {
      tags: { service: "playback", endpoint: "/api/v1/playback/health" },
    });

    check(media, { "media health is 200": (res) => res.status === 200 });
    check(playback, { "playback health is 200": (res) => res.status === 200 });
  });

  sleep(Math.random() * 2 + 1);

  group("analytics readiness", () => {
    const response = http.get(`${API_BASE_URL}/api/v1/analytics/health`, {
      tags: { service: "analytics", endpoint: "/api/v1/analytics/health" },
    });

    check(response, {
      "analytics health is 200": (res) => res.status === 200,
    });
  });

  sleep(Math.random() * 3 + 2);
}
