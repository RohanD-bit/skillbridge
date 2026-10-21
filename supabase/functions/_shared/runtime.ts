// Narrow runtime surface also lets local tsc validate the Deno entry points
// without pretending the Node-based test runner is a live Edge Runtime.
export const edgeRuntime = (
  globalThis as unknown as {
    Deno: {
      env: { get: (name: string) => string | undefined }
      serve: (handler: (request: Request) => Promise<Response>) => unknown
    }
  }
).Deno
