import { browserLogger } from "./browserLogger";

type AsyncTask = () => Promise<unknown> | void;

export function fireAndForget(task: AsyncTask, context = "async task"): void {
  try {
    const result = task();
    Promise.resolve(result)
    .catch((error) => {
      browserLogger.warn(`Unhandled ${context} failure.`, error);
    });
  } catch (error) {
    browserLogger.warn(`Unhandled ${context} failure.`, error);
  }
}
