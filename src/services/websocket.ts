import { MLService } from './ml';
import type { Candle } from '../lib/indicators';

type AssetConfig = {
  name: string;
  enabled: boolean;
};

export const DEFAULT_ASSETS: AssetConfig[] = [
  { name: 'EURUSD_OTC', enabled: true },
  { name: 'EURJPY_OTC', enabled: true },
  { name: 'GBPJPY_OTC', enabled: true },
  { name: 'USDCAD_OTC', enabled: true },
  { name: 'AUDCAD_otc', enabled: true },
  { name: 'EURGBP_OTC', enabled: true },
  { name: 'GBPUSD_OTC', enabled: true },
  { name: 'AUDUSD_OTC', enabled: true },
];

class WebSocketService {
  private ws: WebSocket | null = null;
  private get proxyUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/po-ws`;
  }
  private sessionId = '';
  private uid = '';
  private isDemo = 0;
  
  public onConnect?: () => void;
  public onDisconnect?: () => void;
  public onCandle?: (asset: string, candle: Candle) => void;
  public onCandlesBatch?: (asset: string, candles: Candle[]) => void;
  public onAssetList?: (assets: string[]) => void;

  private pingInterval: any;
  private isConnected = false;
  private subscriptions: string[] = [];
  
  private reconnectAttempts = 0;
  private maxReconnectAttemptsBeforeReFetch = 3;
  private reconnectTimeout: any;

  constructor() {}

  async fetchTokens() {
    try {
      console.log('Fetching fresh tokens...');
      const res = await fetch('https://raw.githubusercontent.com/amontawiah246-blip/pocket-tokens/main/tokens.json', { cache: 'no-store' });
      const data = await res.json();
      this.sessionId = data.session_id;
      this.uid = data.user_id;
      console.log('Tokens fetched successfully.');
      return true;
    } catch (e) {
      console.error('Failed to fetch tokens', e);
      return false;
    }
  }

  async connect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.onclose = null; // Prevent triggering reconnect loop
      this.ws.onerror = null;
      this.ws.close();
    }
    
    // Check if we need to refresh tokens due to repeated failures
    if (this.reconnectAttempts >= this.maxReconnectAttemptsBeforeReFetch) {
       await this.fetchTokens();
       this.reconnectAttempts = 0;
    }
    
    console.log(`Connecting to WS... (Attempt ${this.reconnectAttempts})`);
    this.ws = new WebSocket(this.proxyUrl);

    this.ws.onopen = () => {
      console.log('WS Opened, waiting for Engine.IO handshake');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (e) => {
      const msg = e.data.toString();
      
      if (msg.startsWith('0')) {
        // 1. Engine.IO handshake
        try {
          const data = JSON.parse(msg.substring(1));
          clearInterval(this.pingInterval);
          this.pingInterval = setInterval(() => {
            if (this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send('2'); // Ping
            }
          }, data.pingInterval || 20000);
        } catch(err) {
          console.error("Error parsing Engine.IO handshake", err);
        }
        // 2. Connect to Socket.IO namespace
        this.ws?.send('40');
        
      } else if (msg.startsWith('40')) {
        // 3. Socket.IO connected
        console.log('Socket.IO connected, sending auth payload');
        const authData = {
          session: this.sessionId,
          isDemo: this.isDemo,
          uid: this.uid,
          platform: 2
        };
        this.ws?.send(`42["auth",${JSON.stringify(authData)}]`);
        
      } else if (msg.startsWith('3')) {
        // Pong
        // console.log('Pong received');
      } else if (msg.startsWith('42')) {
        // Data message
        try {
          const payloadStr = msg.substring(2);
          const payload = JSON.parse(payloadStr);
          this.handleMessage(payload[0], payload[1]);
        } catch (err) {
          console.error('Error parsing WS message', msg);
        }
      } else if (msg.startsWith('44')) {
        console.error('Socket.IO Error returned:', msg);
      }
    };

    this.ws.onclose = () => {
      console.log('WS Disconnected');
      this.isConnected = false;
      clearInterval(this.pingInterval);
      this.onDisconnect?.();
      
      this.reconnectAttempts++;
      // Exponential backoff capped at 15 seconds
      const timeout = Math.min(this.reconnectAttempts * 2000, 15000);
      console.log(`Reconnecting in ${timeout}ms...`);
      this.reconnectTimeout = setTimeout(() => this.connect(), timeout);
    };
    
    this.ws.onerror = (e) => {
      console.error('WS Error:', e);
    }
  }

  private handleMessage(event: string, data: any) {
    if (event === 'successauth') {
      console.log('Auth success!');
      this.isConnected = true;
      this.onConnect?.();
      this.subscribeAll();
    } else {
      // Log other events to inspect PO Market data format
      if (event.includes('update') || Array.isArray(data)) {
        console.log(`WS Event: ${event}`, data);
      }
      
      if (event === 'updateStream' || event === 'updateHistoryNew') {
         if(data && data.data && data.data.length > 0) {
             const asset = data.asset;
             if (!asset) return; // sometimes it might be missing
             
             // If historical data payload
             if (data.data.length > 1 && this.onCandlesBatch) {
               const batch = data.data.map((c: any) => ({
                 time: c.time,
                 open: c.open,
                 high: c.high,
                 low: c.low,
                 close: c.close,
                 volume: c.volume || 0
               }));
               this.onCandlesBatch(asset, batch);
             } else {
               data.data.forEach((c: any) => {
                 this.onCandle?.(asset, {
                   time: c.time,
                   open: c.open,
                   high: c.high,
                   low: c.low,
                   close: c.close,
                   volume: c.volume || 0
                 });
               });
             }
         }
      } else if (event === 'updateStream') {
         // Alternative format fallback
         if (Array.isArray(data) && data.length > 0) {
           const asset = data[0];
           if (typeof asset === 'string' && this.subscriptions.includes(asset)) {
              try {
                const candle = {
                  time: data[1],
                  open: data[2],
                  close: data[3],
                  high: data[4],
                  low: data[5]
                };
                this.onCandle?.(asset, candle);
              } catch(e) {}
           }
         }
      }
    }
  }

  public setSubscriptions(assets: string[]) {
    this.subscriptions = assets;
    if (this.isConnected) {
      this.subscribeAll();
    }
  }

  private subscribeAll() {
    this.subscriptions.forEach((asset, idx) => {
      setTimeout(() => {
        if(this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(`42["subfor","${asset}"]`);
        }
      }, idx * 1000); // 1s delay per user requirements
    });
  }
}

export const wsService = new WebSocketService();
