/**
 * Run a task once the JS thread is idle, e.g. after an animation or the first paint.
 *
 * Replaces `InteractionManager.runAfterInteractions`, which React Native 0.88 (Expo SDK 58)
 * removes; React Native points to `requestIdleCallback` instead. Where that global does not exist
 * (Jest, older runtimes) the task runs on the next macrotask, which is what a resolved
 * `runAfterInteractions` did with no interaction in progress.
 *
 * Returns a handle whose `cancel()` drops the task if it has not run yet.
 */
export function runWhenIdle(task: () => void): { cancel: () => void } {
  const g = globalThis as {
    requestIdleCallback?: (cb: () => void) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof g.requestIdleCallback === 'function') {
    const handle = g.requestIdleCallback(task);
    return { cancel: () => g.cancelIdleCallback?.(handle) };
  }
  const timer = setTimeout(task, 0);
  return { cancel: () => clearTimeout(timer) };
}
