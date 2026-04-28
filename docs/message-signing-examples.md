# HMAC Signing for RabbitMQ Events

This document describes the event signing mechanism implemented in StreamButed. The code is **fully implemented** in the actual service files.

## Identity Service (Java) - Signing Events

**Implementation Location**: `services/identity-service/src/main/java/streambuted/identity/messaging/IdentityEventPublisher.java`

The `IdentityEventPublisher` now:
1. **Validates on startup** via `InitializingBean#afterPropertiesSet()`: throws `IllegalArgumentException` if `EVENT_SIGNING_SECRET` is missing or blank
2. **Always signs** events with HMAC-SHA256 (no fallback to unsigned publishing)
3. **Adds header** `X-Event-Signature` containing the Base64-encoded HMAC-SHA256 signature

```java
// Actual implementation snippet:
@Component
@RequiredArgsConstructor
@Slf4j
public class IdentityEventPublisher implements InitializingBean {
    @Value("${EVENT_SIGNING_SECRET:}")
    private String eventSigningSecret;

    @Override
    public void afterPropertiesSet() throws Exception {
        if (eventSigningSecret == null || eventSigningSecret.isBlank()) {
            throw new IllegalArgumentException(
                "EVENT_SIGNING_SECRET must be configured and non-empty. " +
                "This environment variable is required for event signing security."
            );
        }
        log.info("IdentityEventPublisher initialized with event signing enabled.");
    }

    public boolean publishUserPromoted(UserPromotedEvent event) {
        String payloadJson = objectMapper.writeValueAsString(event);
        // Always sign: afterPropertiesSet() guarantees eventSigningSecret is non-null
        String signature = computeHmacBase64(payloadJson, eventSigningSecret);
        MessagePostProcessor mpp = (Message message) -> {
            message.getMessageProperties().setHeader("X-Event-Signature", signature);
            return message;
        };
        rabbitTemplate.convertAndSend(identityExchange, userPromotedRoutingKey, payloadJson, mpp);
        // ... error handling
    }

    private String computeHmacBase64(String payload, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] sig = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(sig);
    }
}
```

## Catalog Service (TypeScript) - Verifying Events

**Implementation Location**: `services/catalog-service/src/infrastructure/messaging/IdentityPromotionConsumer.ts`

The `IdentityPromotionConsumer` now:
1. **Validates on instantiation** in the constructor: throws error if `EVENT_SIGNING_SECRET` is missing or blank
2. **Always verifies** signatures on every message (no conditional logic)
3. **Rejects invalid signatures** with `nack(message, false, false)` to discard the message
4. **Uses timing-safe comparison** (`crypto.timingSafeEqual`) to prevent timing attacks

```ts
// Actual implementation snippet:
export class IdentityPromotionConsumer {
  private readonly signingSecret: string;

  constructor(
    private readonly rabbitMqUrl: string,
    private readonly queueName: string,
    private readonly handleUserPromotedUseCase: HandleUserPromotedUseCase
  ) {
    this.signingSecret = process.env.EVENT_SIGNING_SECRET ?? "";
    if (!this.signingSecret || this.signingSecret.trim().length === 0) {
      throw new Error(
        "EVENT_SIGNING_SECRET must be configured and non-empty. " +
        "This environment variable is required for event signature verification."
      );
    }
  }

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!this.channel || !message) {
      return;
    }

    try {
      // Always verify: constructor guarantees signingSecret is non-empty
      const signatureHeader = message.properties?.headers?.["X-Event-Signature"] as string | undefined;
      const payloadString = message.content.toString();
      const expected = crypto.createHmac("sha256", this.signingSecret).update(payloadString, "utf8").digest("base64");
      const a = Buffer.from(expected, "utf8");
      const b = Buffer.from(String(signatureHeader ?? ""), "utf8");
      const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!valid) {
        console.warn("Rejected message due to invalid signature. Possible tampering or misconfigured publisher.");
        this.channel.nack(message, false, false);
        return;
      }

      // Process event (Zod schema validation + use case execution)
      const payload = JSON.parse(payloadString) as unknown;
      const parsedEvent = userPromotedEventSchema.parse(unwrapPayload(payload));
      // ... rest of processing
    } catch (error) {
      // ... error handling
    }
  }
}
```

## Security Properties

✅ **Implemented**:
- **Fail-fast on startup**: Both services throw errors if `EVENT_SIGNING_SECRET` is missing or empty
- **Mandatory signing**: Identity always signs; Catalog always verifies (no conditional logic)
- **Timing-safe comparison**: Catalog uses `crypto.timingSafeEqual()` to prevent timing attacks
- **Rejection on mismatch**: Invalid signatures trigger `nack` to discard the message
- **Schema validation**: Events are validated with Zod after signature verification

⚠️ **Production Considerations**:
- Store `EVENT_SIGNING_SECRET` in a secure secrets vault (not in version control)
- Rotate the secret regularly according to your security policy
- Monitor for rejected messages (signature failures) — they indicate potential tampering
- Consider adding replay attack protection: `eventId` + `timestamp` validation in `HandleUserPromotedUseCase`
- Use HTTPS for inter-service communication and enable mTLS if available

## Testing

The Postman collection includes negative test cases:
- `Identity - Promote With Invalid userId (negative)`: Validates rejection of malformed UUIDs
- `Identity - Promote With Invalid newRole (negative)`: Validates rejection of invalid role values

To test signature verification in isolation, you can:
1. Send a manually crafted message to RabbitMQ with an invalid `X-Event-Signature` header
2. Verify that the Catalog service rejects it and logs: `"Rejected message due to invalid signature."`
3. Confirm the message is discarded (not retried)
