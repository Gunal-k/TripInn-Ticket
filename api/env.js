// Vercel Serverless Function to dynamically provide the decryption key to the client
// The secret key is stored in Vercel Environment Variables (TRIPINN_SECRET_KEY),
// keeping it private and hidden from the GitHub repository.

if (typeof module !== 'undefined' && module.exports) {
  module.exports = (req, res) => {
    const secretKey = process.env.TRIPINN_SECRET_KEY || process.env.SECRET_KEY || '';

    // Prevent caching of sensitive runtime configuration
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    const accept = req.headers && req.headers['accept'] ? req.headers['accept'] : '';
    const url = req.url || '';

    if (accept.includes('application/json') || url.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).json({ TRIPINN_SECRET_KEY: secretKey });
    }

    // Default: JavaScript response suitable for <script src="/api/env.js">
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    return res.status(200).send(`window.TRIPINN_SECRET_KEY = ${JSON.stringify(secretKey)};`);
  };
}
