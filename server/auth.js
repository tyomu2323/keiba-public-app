import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export function signToken(username) {
  return jwt.sign({ username, role: 'admin' }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '12h' });
}
export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'login_required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}
export function passwordMatches(input, expectedPlain) {
  if (!expectedPlain) return false;
  if (expectedPlain.startsWith('$2')) return bcrypt.compareSync(input, expectedPlain);
  return input === expectedPlain;
}
