# Postman Integration Tests (Identity + Catalog + Playback)

## Files

- `StreamButed-Identity-Catalog.postman_collection.json`
- `StreamButed-Current-Auth-Smoke.postman_collection.json`
- `StreamButed.local.postman_environment.json`

## What this collection covers

### Current Auth Smoke

`StreamButed-Current-Auth-Smoke.postman_collection.json` is aligned with the current email-verification registration flow. It covers service health, pending registration, login rejection before verification, resend invalidating the previous attempt, cancel invalidating the active attempt, Google OAuth redirect configuration, public catalog search, and protected catalog write rejection without a JWT.

Run it with:

```powershell
npx --yes newman run tests/postman/StreamButed-Current-Auth-Smoke.postman_collection.json -e tests/postman/StreamButed.local.postman_environment.json
```

### Legacy Full Flow

1. Health checks for both services.
2. Identity auth lifecycle: register, login, refresh, promote.
3. Cross-service communication: `identity-service` promotion event consumed by `catalog-service`.
4. Catalog protected CRUD flow with JWT from Identity.
5. Playback health check through Gateway.
6. Negative cases (auth failures and unauthorized catalog writes).

This full-flow collection predates the email verification registration change and must be updated with a deterministic verification-code strategy before it can complete the protected album/track flow again.

## Run in Postman UI

1. Import both collections plus the environment file.
2. Select environment: `StreamButed Local`.
3. Run `StreamButed-Current-Auth-Smoke.postman_collection.json` for the current registration/auth smoke flow.
4. Run `StreamButed-Identity-Catalog.postman_collection.json` only if you are validating the legacy flow that still needs adaptation to the email-verification registration.

## Run with Newman (CLI)

From repo root:

```powershell
npm install -g newman
newman run tests/postman/StreamButed-Identity-Catalog.postman_collection.json -e tests/postman/StreamButed.local.postman_environment.json
```

## Notes

- The current auth smoke collection proves replacement and cancellation invalidation by asserting the backend returns the specific invalidated-attempt message, not only a generic `400`.
- The legacy full-flow collection includes a polling mechanism when checking if a promoted user is replicated to the catalog service. Since the replication happens asynchronously via RabbitMQ, the test retries up to 5 times (with 500ms delays) to account for network and processing latency.
