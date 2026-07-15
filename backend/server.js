/**
 * backend/server.js
 * Local development server — NOT used on Vercel.
 * Vercel uses backend/api/index.js instead.
 *
 * Usage: npm run backend:dev
 */
require('dotenv').config();
const config = require('./config');
config.validate(); // Check env vars before starting

const app = require('./app');

const PORT = config.port;

app.listen(PORT, () => {
  console.log('\n🚀 Mooncraft API (local dev) running');
  console.log(`   ➜  http://localhost:${PORT}/api/health`);
  console.log(`   ➜  Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

