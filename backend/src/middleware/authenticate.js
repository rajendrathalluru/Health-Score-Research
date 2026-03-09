import jwt from 'jsonwebtoken';

/**
 * Reusable auth middleware.
 * Reads the Bearer token from Authorization header,
 * verifies it, and attaches the decoded user to req.user.
 *
 * Usage in any route file:
 *   import { authenticate } from '../middleware/authenticate.js';
 *   router.post('/', authenticate, async (req, res) => { ... });
 */
export function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');

    // decoded contains { userId, email, iat, exp } — match what auth.js signs
    req.user = { id: decoded.userId, email: decoded.email };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}