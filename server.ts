import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Create HTTP server
  const server = createServer(app);

  // Set up WebSocket proxy to PO Market
  const wss = new WebSocketServer({ server, path: '/api/po-ws' });

  wss.on('connection', (clientWs, req) => {
    console.log('Client connected to proxy WS');
    
    // Connect to Pocket Option with Origin header
    const poUrl = 'wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket';
    const poWs = new WebSocket(poUrl, {
      headers: {
        'Origin': 'https://pocketoption.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    poWs.on('open', () => {
      console.log('Proxy connected to PO WS');
    });

    // PO -> Client
    poWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    // Client -> PO
    clientWs.on('message', (data) => {
      if (poWs.readyState === WebSocket.OPEN) {
        poWs.send(data);
      }
    });

    poWs.on('close', () => clientWs.close());
    clientWs.on('close', () => poWs.close());

    poWs.on('error', (err) => {
      console.error('PO proxy error:', err);
      clientWs.close();
    });
    
    clientWs.on('error', (err) => {
      console.error('Client WS error:', err);
      poWs.close();
    });
  });

  // Basic API Route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Vite middleware for development or Static files for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
