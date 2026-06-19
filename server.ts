/**
 * server.ts — Local Dev & Production Express Server
 *
 * Imports the app from app.ts and adds Vite dev middleware (dev) or
 * static file serving (production), then starts listening on PORT 3000.
 *
 * Vercel deployments use api/index.ts instead — this file is never
 * executed in a serverless environment.
 */
import express from 'express';
import app from './app';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;

// ─── Dev Server Startup (only when run directly, not when imported by Vercel) ──

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined;

if (!isVercel) {
  startDevServer();
}

async function startDevServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Vite dev server] Mounted middleware successfully.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('[Static Server] Serving compiled SPA assets from dist/');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AI Match Predictor Server] Running at: http://localhost:${PORT}`);
  });
}
