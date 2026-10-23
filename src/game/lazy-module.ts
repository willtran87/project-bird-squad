/** One in-flight import per feature. Failed requests remain observable by the
 * caller, but never poison the next attempt. Creating a loader does no I/O. */
export function lazyModule<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) {
      const request = load();
      pending = request;
      void request.catch(() => { if (pending === request) pending = undefined; });
    }
    return pending;
  };
}
