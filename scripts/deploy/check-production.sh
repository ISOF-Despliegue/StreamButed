#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
API_ORIGIN="${API_ORIGIN:-https://api.migueleelg0106.me}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://migueleelg0106.me}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

failures=0

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  failures=$((failures + 1))
}

ok() {
  printf 'OK: %s\n' "$1"
}

warn() {
  printf 'WARN: %s\n' "$1" >&2
}

require_file() {
  [ -f "$1" ] || fail "Required file not found: $1"
}

get_env_value() {
  local key="$1"
  awk -F= -v key="$key" '
    $0 !~ /^[[:space:]]*#/ && $1 == key {
      sub(/^[^=]*=/, "", $0);
      print $0;
      exit;
    }
  ' "$ENV_FILE"
}

require_env() {
  local key="$1"
  local value
  value="$(get_env_value "$key" || true)"
  if [ -z "${value// }" ]; then
    fail "Missing required environment variable: $key"
  fi
}

check_safe_value() {
  local key="$1"
  local value
  value="$(get_env_value "$key" || true)"
  [ -n "$value" ] || return 0

  local lower
  lower="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  case "$lower" in
    *localhost*|*127.0.0.1*|*replace_with*|*changeme*|*change_me*|*password*|*secret*|*default*|*example*)
      fail "Unsafe placeholder-like production value for $key"
      ;;
  esac
}

require_file "$COMPOSE_FILE"
require_file "$ENV_FILE"

required_vars=(
  FRONTEND_URL
  CORS_ALLOWED_ORIGINS
  GOOGLE_CALLBACK_URL
  JWT_ISSUER
  JWT_AUDIENCE
  JWT_KEY_ID
  EVENT_SIGNING_SECRET
  STREAMING_PLAYBACK_TOKEN_SECRET
  SPRING_PROFILES_ACTIVE
  DB_DDL_AUTO
  REFRESH_COOKIE_SECURE
  POSTGRES_USER
  POSTGRES_PASSWORD
  POSTGRES_IDENTITY_DB
  POSTGRES_CATALOG_DB
  POSTGRES_IDENTITY_APP_USER
  POSTGRES_IDENTITY_APP_PASSWORD
  POSTGRES_CATALOG_APP_USER
  POSTGRES_CATALOG_APP_PASSWORD
  POSTGRES_IDENTITY_MIGRATOR_USER
  POSTGRES_IDENTITY_MIGRATOR_PASSWORD
  POSTGRES_CATALOG_MIGRATOR_USER
  POSTGRES_CATALOG_MIGRATOR_PASSWORD
  CATALOG_MIGRATOR_DATABASE_URL
  STREAMING_MONGO_URI
  STREAMING_MONGO_DB
  STREAMING_MONGO_ROOT_USER
  STREAMING_MONGO_ROOT_PASSWORD
  STREAMING_MONGO_APP_USER
  STREAMING_MONGO_APP_PASSWORD
  ANALYTICS_MONGO_URI
  ANALYTICS_MONGO_DB
  ANALYTICS_MONGO_ROOT_USER
  ANALYTICS_MONGO_ROOT_PASSWORD
  ANALYTICS_MONGO_APP_USER
  ANALYTICS_MONGO_APP_PASSWORD
  ANALYTICS_PLAYBACK_QUEUE
  ANALYTICS_LOGIN_QUEUE
  ANALYTICS_CATALOG_QUEUE
  RABBITMQ_DEFAULT_USER
  RABBITMQ_DEFAULT_PASS
  MINIO_ACCESS_KEY
  MINIO_SECRET_KEY
  MINIO_BUCKET
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  EMAIL_HOST
  EMAIL_USER
  EMAIL_PASSWORD
  MEDIASOUP_ANNOUNCED_IP
  RTC_MIN_PORT
  RTC_MAX_PORT
)

for key in "${required_vars[@]}"; do
  require_env "$key"
  check_safe_value "$key"
done

if [ -z "$(get_env_value JWT_RSA_PRIVATE_KEY_BASE64)" ] && [ -z "$(get_env_value JWT_RSA_PRIVATE_KEY_PEM)" ]; then
  fail "JWT RSA private key must be configured as base64 or PEM"
fi

if [ -z "$(get_env_value JWT_RSA_PUBLIC_KEY_BASE64)" ] && [ -z "$(get_env_value JWT_RSA_PUBLIC_KEY_PEM)" ]; then
  fail "JWT RSA public key must be configured as base64 or PEM"
fi

[ "$(get_env_value DB_DDL_AUTO)" = "validate" ] || [ "$(get_env_value DB_DDL_AUTO)" = "none" ] \
  || fail "DB_DDL_AUTO must be validate or none"

[ "$(get_env_value REFRESH_COOKIE_SECURE)" = "true" ] || fail "REFRESH_COOKIE_SECURE must be true"

case "$(get_env_value MEDIASOUP_ANNOUNCED_IP)" in
  ""|"127."*|"0.0.0.0"|localhost)
    fail "MEDIASOUP_ANNOUNCED_IP must be the public Droplet IP"
    ;;
esac

rtc_min="$(get_env_value RTC_MIN_PORT)"
rtc_max="$(get_env_value RTC_MAX_PORT)"
if ! printf '%s\n%s\n' "$rtc_min" "$rtc_max" | grep -Eq '^[0-9]+$'; then
  fail "RTC_MIN_PORT and RTC_MAX_PORT must be numeric"
elif [ "$rtc_min" -gt "$rtc_max" ]; then
  fail "RTC_MIN_PORT cannot be greater than RTC_MAX_PORT"
fi

case "$(get_env_value CORS_ALLOWED_ORIGINS)" in
  *"*"*) fail "CORS_ALLOWED_ORIGINS cannot contain wildcard" ;;
esac

"${COMPOSE[@]}" config --quiet && ok "docker compose production config is valid" \
  || fail "docker compose production config is invalid"

if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    if "${COMPOSE[@]}" ps >/dev/null 2>&1; then
      ok "docker compose ps is available"
      published_ports="$("${COMPOSE[@]}" ps 2>/dev/null || true)"
      if printf '%s\n' "$published_ports" | grep -E '(0\.0\.0\.0:|:::)(5432|5433|5434|27017|5672|15672|9000|9001|9091|9092|9093)' >/dev/null; then
        fail "Unexpected public/internal service port appears in docker compose ps output"
      else
        ok "No DB/Mongo/RabbitMQ/MinIO/gRPC ports appear publicly published"
      fi
      if printf '%s\n' "$published_ports" | grep -E "(0\.0\.0\.0:|:::)$rtc_min-$rtc_max->.*udp" >/dev/null; then
        ok "Live WebRTC UDP range $rtc_min-$rtc_max is published"
      elif printf '%s\n' "$published_ports" | grep -E "(0\.0\.0\.0:|:::)$rtc_min->$rtc_min/udp" >/dev/null \
        && printf '%s\n' "$published_ports" | grep -E "(0\.0\.0\.0:|:::)$rtc_max->$rtc_max/udp" >/dev/null; then
        ok "Live WebRTC UDP range $rtc_min-$rtc_max is published"
      else
        fail "Live WebRTC UDP range $rtc_min-$rtc_max is not published; video will stay black behind NAT/firewall"
      fi
    else
      warn "Services are not running yet; skipped live docker port inspection"
    fi
  else
    warn "Docker daemon is not available; skipped runtime container checks"
  fi
else
  warn "Docker CLI is not installed; skipped compose runtime checks"
fi

if command -v curl >/dev/null 2>&1; then
  if curl -fsSIL --max-time 10 "$API_ORIGIN/api/v1/catalog/health" >/tmp/streambuted_api_headers.txt; then
    ok "HTTPS API health endpoint responded"
    grep -qi '^strict-transport-security:' /tmp/streambuted_api_headers.txt || fail "Missing Strict-Transport-Security header"
    grep -qi '^x-content-type-options: nosniff' /tmp/streambuted_api_headers.txt || fail "Missing X-Content-Type-Options nosniff header"
  else
    warn "HTTPS API health check did not respond; this is expected before DNS/TLS deployment"
  fi

  if curl -fsSI --max-time 10 "$API_ORIGIN/api/v1/analytics/health" >/dev/null; then
    ok "HTTPS Analytics health endpoint responded"
  else
    warn "HTTPS Analytics health check did not respond; this is expected before DNS/TLS deployment"
  fi

  http_status="$(curl -sSIL --max-time 10 "http://api.migueleelg0106.me/api/v1/catalog/health" 2>/dev/null | awk 'BEGIN{IGNORECASE=1} /^HTTP\//{code=$2} END{print code}')"
  if [ "$http_status" = "301" ] || [ "$http_status" = "308" ]; then
    ok "HTTP redirects to HTTPS"
  else
    warn "HTTP redirect could not be verified before DNS/TLS deployment"
  fi

  cors_headers="$(curl -fsSI --max-time 10 -H "Origin: $FRONTEND_ORIGIN" "$API_ORIGIN/api/v1/catalog/health" 2>/dev/null || true)"
  if printf '%s\n' "$cors_headers" | grep -qi "access-control-allow-origin: $FRONTEND_ORIGIN"; then
    ok "CORS echoes the frontend origin"
  elif [ -n "$cors_headers" ]; then
    fail "CORS did not echo the expected frontend origin"
  else
    warn "CORS could not be verified before API deployment"
  fi
else
  warn "curl is not installed; skipped HTTPS/header/CORS checks"
fi

warn "Refresh cookie flags require a real login flow test; verify Secure and HttpOnly in browser devtools."

if [ "$failures" -gt 0 ]; then
  printf '\n%d critical production check(s) failed.\n' "$failures" >&2
  exit 1
fi

printf '\nProduction checks completed without critical local failures.\n'
