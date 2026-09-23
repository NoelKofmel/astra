/** Runs once when a server instance starts, before it handles a request. */
export async function register(): Promise<void> {
  // Node-only code lives in its own module so the Edge build never sees it.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node.ts");
  }
}
