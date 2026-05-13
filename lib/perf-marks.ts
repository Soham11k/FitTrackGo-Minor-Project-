import { performance } from "node:perf_hooks"

/** Server instrumentation marks (paired with Observed web-vitals on the client). */
export function bootPerfInstrumentation() {
  try {
    performance.mark("fittrack:server-register")
  } catch {
    /* noop */
  }
}
