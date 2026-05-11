import { Request, Response, NextFunction } from 'express'

export interface AppError extends Error {
  statusCode?: number
}

// Global error handler — must be registered last in app.ts
export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const status = err.statusCode ?? 500
  const message = err.message || 'Internal Server Error'

  console.error(`[Error] ${status} — ${message}`)

  res.status(status).json({ error: message })
}
