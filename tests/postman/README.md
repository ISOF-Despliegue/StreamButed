# Postman Integration Tests (Identity + Catalog)

## Files

- `StreamButed-Identity-Catalog.postman_collection.json`
- `StreamButed.local.postman_environment.json`

## What this collection covers

1. Health checks for both services.
2. Identity auth lifecycle: register, login, refresh, promote.
3. Cross-service communication: `identity-service` promotion event consumed by `catalog-service`.
4. Catalog protected CRUD flow with JWT from Identity.
5. Negative cases (auth failures and unauthorized catalog writes).

## Run in Postman UI

1. Import both JSON files.
2. Select environment: `StreamButed Local`.
3. Run the full collection in order.

## Run with Newman (CLI)

From repo root:

```powershell
npm install -g newman
newman run tests/postman/StreamButed-Identity-Catalog.postman_collection.json -e tests/postman/StreamButed.local.postman_environment.json
```

## Important note about current project state

During live verification, two backend issues were detected and can make the collection fail before completing all checks:

1. `catalog-service` database schema is missing (`public.artist` table does not exist), causing `500` on artist reads.
2. `catalog-service` consumer rejects `user.promoted` events because `promotedAt` arrives as number while schema expects string.

These are real integration findings from current running containers, not Postman errors.
