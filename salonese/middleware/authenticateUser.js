// middleware/authenticateUser.js
const jwt = require('jsonwebtoken');

const SUPABASE_JWT = process.env.SUPABASE_JWT || 'U6fZxY8aAbfE3ISBC5Lpb8ISiwGpd8lxFnsMYWuX9gkmW1u/P7ZPAnDINEQfiGp6aZfp0KOyuv6m7lDp4UiO8A==';

const authenticateUser = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, SUPABASE_JWT, {
      algorithms: ['HS256'], // Supabase uses HS256
    });

    // Attach full user info and email to request
    req.user = {
      email: decoded.email,
      ...decoded,
    };

    next();
  } catch (err) {
    console.error('JWT verification error:', err.message);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

module.exports = authenticateUser;
