import { fireAndForget } from "./fireAndForget";
import { browserLogger } from "./browserLogger";

jest.mock("./browserLogger", () => ({
  browserLogger: {
    warn: jest.fn(),
  },
}));

describe("fireAndForget", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs rejected async tasks", async () => {
    fireAndForget(() => Promise.reject(new Error("boom")), "demo task");
    await Promise.resolve();
    await Promise.resolve();

    expect(browserLogger.warn).toHaveBeenCalledWith("Unhandled demo task failure.", expect.any(Error));
  });

  it("runs synchronous tasks without crashing", async () => {
    const task = jest.fn();
    fireAndForget(task, "sync task");
    await Promise.resolve();

    expect(task).toHaveBeenCalledTimes(1);
  });

  it("logs synchronous failures too", () => {
    fireAndForget(() => {
      throw new Error("sync boom");
    }, "sync task");

    expect(browserLogger.warn).toHaveBeenCalledWith("Unhandled sync task failure.", expect.any(Error));
  });
});
