import type { Request, Response } from 'express';
import mongoose from 'mongoose';

export function healthCheck(_req: Request, res: Response): void {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  res.json({
    success: true,
    message: 'Service is healthy',
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
    },
  });
}
