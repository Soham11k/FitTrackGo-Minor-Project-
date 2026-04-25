type LogContext = Record<string, unknown>

function base(level: 'info' | 'warn' | 'error', message: string, context?: LogContext) {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    requestId: context?.requestId ?? null,
    ...context,
  }
  const line = JSON.stringify(payload)
  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.log(line)
}

export const logger = {
  info(message: string, context?: LogContext) {
    base('info', message, context)
  },
  warn(message: string, context?: LogContext) {
    base('warn', message, context)
  },
  error(message: string, context?: LogContext) {
    base('error', message, context)
  },
}
