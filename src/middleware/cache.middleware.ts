import { Request, Response, NextFunction } from 'express';
import redis from '../lib/redis';

// Default cache duration: 60 seconds
const DEFAULT_EXPIRATION = 60;

export const cacheMiddleware = (durationInSeconds: number = DEFAULT_EXPIRATION) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    // Build a unique cache key based on the URL and query parameters
    const cacheKey = `__express__${req.originalUrl || req.url}`;

    try {
      const cachedData = await redis.get(cacheKey);

      if (cachedData) {
        res.json(JSON.parse(cachedData));
        return;
      }

      // If not in cache, we need to intercept res.json
      const originalJson = res.json.bind(res);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      res.json = (body: any) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis.setex(cacheKey, durationInSeconds, JSON.stringify(body))
            .catch((err: any) => console.error('Redis cache error:', err));
        }
        return originalJson(body);
      };

      next();
    } catch (err: any) {
      console.error('Cache middleware error:', err);
      next(); // Fail gracefully and proceed without cache
    }
  };
};
