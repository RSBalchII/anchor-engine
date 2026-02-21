/**
 * API Key Authentication Middleware
 * 
 * Validates Bearer token from Authorization header against the configured API key.
 * When no API key is configured (empty string), authentication is disabled (open access).
 * 
 * Usage:
 *   import { createAuthMiddleware } from './middleware/auth.js';
 *   const auth = createAuthMiddleware(config.server?.api_key);
 *   app.use('/v1', auth);
 */

/**
 * Create an Express middleware that validates API key from Authorization header
 * @param {string} apiKey - The expected API key. Empty/falsy = auth disabled.
 * @returns {import('express').RequestHandler}
 */
export function createAuthMiddleware(apiKey) {
  return (req, res, next) => {
    // If no API key configured, skip authentication (open access)
    if (!apiKey) {
      return next();
    }

    // Allow health endpoints without auth
    if (req.path === '/health' || req.path.startsWith('/health/')) {
      return next();
    }

    const authHeader = req.headers['authorization'];

    if (!authHeader) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Provide an API key via Authorization: Bearer <key>'
      });
    }

    // Support "Bearer <key>" format
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : authHeader.trim();

    if (token !== apiKey) {
      return res.status(403).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
    }

    next();
  };
}
