/**
 * backend/server.js
 * Local development server — NOT used on Vercel.
 * Vercel uses backend/api/index.js instead.
 *
 * Usage: npm run backend:dev
 */
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('\n🚀 Mooncraft API (local dev) running');
  console.log(`   ➜  http://localhost:${PORT}/api/health`);
  console.log(`   ➜  Environment: ${process.env.NODE_ENV || 'development'}\n`);
});
