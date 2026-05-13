export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { bootPerfInstrumentation } = await import("./lib/perf-marks").catch(() => ({
    bootPerfInstrumentation: () => {},
  }))
  bootPerfInstrumentation()
}
