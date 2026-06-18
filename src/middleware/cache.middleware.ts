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

    // If Redis is not connected/ready, fail fast and proceed without cache
    if (redis.status !== 'ready') {
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

export const invalidateCacheMiddleware = (linkedResources: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only care about mutating requests
    if (req.method === 'GET') {
      next();
      return;
    }

    const originalJson = res.json.bind(res);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && redis.status === 'ready') {
        const match = req.originalUrl.match(/^\/([^\/?#]+)/);
        const baseRoute = match ? `/${match[1]}` : '';

        const resourcesToInvalidate = new Set<string>();
        if (baseRoute) {
          resourcesToInvalidate.add(baseRoute);
        }
        for (const resName of linkedResources) {
          resourcesToInvalidate.add(resName.startsWith('/') ? resName : `/${resName}`);
        }

        Promise.all(
          Array.from(resourcesToInvalidate).map(async (resource) => {
            const pattern = `__express__${resource}*`;
            try {
              const keys = await redis.keys(pattern);
              if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`[Cache Invalidation] Cleared keys for pattern ${pattern}:`, keys);
              }
            } catch (err) {
              console.error(`[Cache Invalidation] Failed to clear keys for pattern ${pattern}:`, err);
            }
          })
        ).catch((err) => console.error('[Cache Invalidation] Error:', err));
      }
      return originalJson(body);
    };

    next();
  };
};
