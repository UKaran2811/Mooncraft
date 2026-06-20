/**
 * backend/api/index.js
 *
 * Vercel Serverless Function entry point.
 *
 * Vercel sees any file inside /api/ as a serverless function.
 * This file re-exports the Express app so Vercel can invoke it
 * as a standard Node.js HTTP handler — no code changes needed.
 *
 * In local development, use `npm run backend:dev` which runs
 * backend/server.js (a wrapper that calls app.listen()).
 */

const app = require('../app');

// Vercel expects a function that accepts (req, res)
// Express apps already match this signature exactly.
module.exports = app;
