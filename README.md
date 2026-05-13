# OTC Market AI - Local & Deployment Guide

This project includes a React frontend and an Express/WebSocket proxy backend that connects to live OTC market data, avoiding browser CORS restrictions. 

## Running Locally on Your Laptop

To run this application locally, you just need Node.js installed.

1. **Open a terminal** and clone or extract the project files.
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run the development server:**
   ```bash
   npm run dev
   ```
4. **Open your browser** and navigate to `http://localhost:3000`. The app will load with the live market data working properly (the proxy will forward connections automatically on your local machine).

## Deploying to Railway (Free/Paid Hosting)

When you deploy to Railway, it will automatically detect the Node.js environment. Make sure to:

1. **Deploying via GitHub:** Push this code to a GitHub repository, then link the repo in Railway.
2. **Build and Start Commands:** Railway usually detects these automatically from the `package.json`, but if it asks:
   - **Install Command:** `npm install`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm run start`
   *(Railway will automatically set the `PORT` environment variable, which the Express server is configured to use.)*
3. The WebSocket proxy uses relative paths (`window.location.host`), so once it is hosted on Railway, it will seamlessly connect to the backend without any changes needed on your end.

## How the Live Data Works

1. The frontend attempts to establish a WebSocket connection to `ws://YOUR_DOMAIN/api/po-ws` (or `localhost:3000`).
2. The Express server (`server.ts`) catches this connection.
3. The Express server acts as a middleman (proxy) and connects securely to the Pocket Option API: `wss://api-eu.po.market/socket.io/?EIO=4&transport=websocket` while providing the required `Origin` and `User-Agent` headers.
4. Live market prices are passed down to your frontend in real-time.
