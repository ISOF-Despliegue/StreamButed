import http from "k6/http";
import { check, sleep } from "k6";

const API_BASE_URL = (__ENV.API_BASE_URL || "https://api.migueleelg0106.me").replace(/\/$/, "");
const SEARCH_TERMS = (__ENV.CATALOG_SEARCH_TERMS || "a,music,rock,pop").split(",").map((term) => term.trim()).filter(Boolean);

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 15 },
    { duration: "1m", target: 25 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const searchTerm = SEARCH_TERMS[Math.floor(Math.random() * SEARCH_TERMS.length)] || "a";
  const offset = Math.floor(Math.random() * 3) * 10;
  const searchUrl = `${API_BASE_URL}/api/v1/catalog/search?searchTerm=${encodeURIComponent(searchTerm)}&limit=10&offset=${offset}`;

  const response = http.get(searchUrl, {
    tags: { service: "catalog", endpoint: "/api/v1/catalog/search" },
  });

  check(response, {
    "catalog search status is 200": (res) => res.status === 200,
    "catalog search returns json": (res) => (res.headers["Content-Type"] || "").includes("application/json"),
  });

  // TODO: If production-safe IDs are available, add read-only GET calls such as:
  // GET /api/v1/catalog/artists/{artistId}
  // GET /api/v1/catalog/artists/{artistId}/albums
  // GET /api/v1/catalog/artists/{artistId}/tracks
  // GET /api/v1/catalog/albums/{albumId}
  // GET /api/v1/catalog/albums/{albumId}/tracks
  // GET /api/v1/catalog/tracks/{trackId}

  sleep(Math.random() * 2 + 1);
}
