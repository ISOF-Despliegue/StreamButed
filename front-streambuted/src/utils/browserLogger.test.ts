import { browserLogger } from "./browserLogger";

describe("browserLogger", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("redacts sensitive tokens and credentials from logged metadata", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    browserLogger.error(
      "Request failed with Bearer secret-token and playbackToken=stream-secret",
      {
        authorization: "Bearer secret-token",
        refreshToken: "refresh-secret",
        nested: {
          password: "SecurePass1!",
        },
      },
      new Error('{"accessToken":"jwt-secret","attemptId":"attempt-secret"}')
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Request failed with Bearer [REDACTED] and playbackToken=[REDACTED]",
      {
        authorization: "[REDACTED]",
        refreshToken: "[REDACTED]",
        nested: {
          password: "[REDACTED]",
        },
      },
      expect.objectContaining({
        name: "Error",
        message: '{"accessToken":"[REDACTED]","attemptId":"[REDACTED]"}',
      })
    );
  });
});
