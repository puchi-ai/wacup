/**
 * Vercel Serverless Entry Point
 *
 * Imports the Express app from server.ts and exports it as the default
 * handler for Vercel's @vercel/node runtime. Vercel handles all incoming
 * HTTP requests through this single serverless function, routing them
 * to the correct Express middleware.
 *
 * Rewrites in vercel.json send all /api/(.*) and / requests here.
 */
import app from '../server';

export default app;
