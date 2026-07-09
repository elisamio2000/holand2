/** Serialize rapid togglePlay calls without a fixed timeout race. */

export function createTogglePlayLock() {
  let chain: Promise<void> = Promise.resolve();

  return {
    run(action: () => void | Promise<void>): void {
      chain = chain.then(async () => {
        await action();
      });
    },
  };
}
