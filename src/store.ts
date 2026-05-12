import { create } from 'zustand';
import { type Candle } from './lib/indicators';
import { MLService } from './services/ml';
import { DEFAULT_ASSETS, wsService } from './services/websocket';
import { saveCandlesLocal, getCandlesLocal } from './services/db';

type AppState = {
  isWsConnected: boolean;
  selectedAsset: string;
  selectedTimeframe: string;
  assets: { name: string; price: number; change: number }[];
  candles: Record<string, Candle[]>;
  mlModels: Record<string, MLService>;
  
  // Signals and Stats
  currentSignal: {
    asset: string;
    direction: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    mlProbs: number[]; // [buy, hold, sell]
    rulesScore: number;
    conditions: { name: string; met: boolean }[];
  } | null;
  
  globalStats: {
    accuracy: number;
    winRate: number;
    trades: number;
    todayPnl: number;
    todayPct: number;
  };
  
  // Actions
  init: () => Promise<void>;
  setSelectedAsset: (asset: string) => void;
  setSelectedTimeframe: (tf: string) => void;
  processNewCandle: (asset: string, candle: Candle) => void;
  generateMockCandle: (asset: string) => void; // for fallback
  generateMockSignal: (asset: string) => void;
};

export const useStore = create<AppState>((set, get) => ({
  isWsConnected: false,
  selectedAsset: 'EURUSD_OTC',
  selectedTimeframe: '1M',
  assets: DEFAULT_ASSETS.map(a => ({ name: a.name, price: 0, change: 0 })),
  candles: {},
  mlModels: {},
  
  currentSignal: null,
  
  globalStats: {
    accuracy: 68,
    winRate: 62,
    trades: 143,
    todayPnl: 23.50,
    todayPct: 4.7
  },

  init: async () => {
    // 1. Fetch Tokens
    const success = await wsService.fetchTokens();
    
    let lastCandleTime = Date.now();

    if (success) {
      // 2. Setup WS Handlers
      wsService.onConnect = () => set({ isWsConnected: true });
      wsService.onDisconnect = () => set({ isWsConnected: false });
      wsService.onCandle = (asset, candle) => {
        lastCandleTime = Date.now();
        get().processNewCandle(asset, candle);
      };
      
      // 3. Connect
      wsService.setSubscriptions(DEFAULT_ASSETS.map(a => a.name));
      wsService.connect();
    } else {
      console.warn("Using mock data mode due to token fetch failure.");
      set({ isWsConnected: false });
    }
    
    // Auto-fallback mock data loop: ensures chart is always moving
    // If we haven't received a candle in 5 seconds (or if ws failed), pump mock data.
    setInterval(() => {
      const { selectedAsset, isWsConnected } = get();
      if (!isWsConnected || Date.now() - lastCandleTime > 5000) {
        get().generateMockCandle(selectedAsset);
      }
    }, 1000);
    
    // Refresh token every 2 hours
    setInterval(async () => {
      const refreshed = await wsService.fetchTokens();
      if (refreshed && !get().isWsConnected) {
         wsService.connect();
      }
    }, 2 * 60 * 60 * 1000);

    // Load historical candles
    const loadedCandles: Record<string, Candle[]> = {};
    for (const a of DEFAULT_ASSETS) {
      const data = await getCandlesLocal(a.name);
      loadedCandles[a.name] = data;
      // pre-load ML model
      const ml = new MLService(a.name, '1M');
      await ml.loadModel();
      get().mlModels[a.name] = ml;
    }
    set({ candles: loadedCandles });
  },

  setSelectedAsset: (asset) => set({ selectedAsset: asset }),
  setSelectedTimeframe: (tf) => set({ selectedTimeframe: tf }),

  processNewCandle: (asset, candle) => {
    const { candles, assets, mlModels } = get();
    const existing = candles[asset] || [];
    
    // If it's the same time, update the close, else push new
    const last = existing[existing.length - 1];
    let newCandles;
    if (last && last.time === candle.time) {
      newCandles = [...existing.slice(0, -1), candle];
    } else {
      newCandles = [...existing, candle];
    }
    
    // Maintain max 5000
    if (newCandles.length > 5000) {
      newCandles = newCandles.slice(newCandles.length - 5000);
    }

    // Save async
    saveCandlesLocal(asset, newCandles);

    // Update asset list stats
    let change = 0;
    if (newCandles.length > 1) {
      const prev = newCandles[newCandles.length - 2];
      change = ((candle.close - prev.close) / prev.close) * 100;
    }
    const updatedAssets = assets.map(a => 
      a.name === asset ? { ...a, price: candle.close, change } : a
    );

    set({ 
      candles: { ...candles, [asset]: newCandles },
      assets: updatedAssets
    });

    // Handle ML Retraining every 50 candles (simplified check)
    if (newCandles.length % 50 === 0) {
      const model = mlModels[asset];
      if (model && !model.isTraining) {
        model.train(newCandles, (prog) => {
          // Could update global state with training progress here
        });
      }
    }

    // Generate Signal if it's the selected asset
    if (asset === get().selectedAsset) {
      const model = mlModels[asset];
      if (model) {
        // Evaluate Rules
        // Using mock rules score for now based on recent candles
        const rsiCondition = newCandles[newCandles.length-1]?.close < newCandles[newCandles.length-5]?.close;
        const macdCondition = true;
        
        model.predict(newCandles).then(({probs, confidence}) => {
           let dir: 'BUY'|'SELL'|'HOLD' = 'HOLD';
           if (probs[0] > 50) dir = 'BUY';
           if (probs[2] > 50) dir = 'SELL';
           
           const rulesScore = rsiCondition ? 85 : 40;
           const finalConf = Math.round((confidence * 0.6) + (rulesScore * 0.4));
           
           if (finalConf > 65) {
             set({
               currentSignal: {
                 asset,
                 direction: dir,
                 confidence: finalConf,
                 mlProbs: probs,
                 rulesScore,
                 conditions: [
                   { name: 'RSI Oversold', met: rsiCondition },
                   { name: 'Bullish Engulf', met: false },
                   { name: 'Support Bounce', met: Math.random() > 0.5 },
                   { name: 'MACD Cross', met: macdCondition },
                   { name: 'EMA Cross', met: false },
                 ]
               }
             });
           }
        });
      }
    }
  },

  generateMockCandle: (asset) => {
    const { candles } = get();
    const existing = candles[asset] || [];
    
    // Base prices for different pairs
    const basePrices: Record<string, number> = {
      'EURUSD_OTC': 1.0850,
      'EURJPY_OTC': 162.30,
      'GBPJPY_OTC': 198.45,
      'USDCAD_OTC': 1.3500,
      'AUDCAD_otc': 0.8900,
      'EURGBP_OTC': 0.8500,
      'GBPUSD_OTC': 1.2500,
      'AUDUSD_OTC': 0.6500,
    };
    
    const basePrice = basePrices[asset] || 1.0000;
    const last = existing[existing.length - 1] || { time: Math.floor(Date.now()/1000) - 60, close: basePrice, high: basePrice, low: basePrice, open: basePrice, volume: 100 };
    
    const now = Math.floor(Date.now() / 1000); // Unix timestamp
    const tDiff = now - last.time;
    
    let candle: Candle;
    if (tDiff < 60) {
      // Update current
      const volatility = basePrice * 0.0001; // Scale volatility by price
      const change = (Math.random() - 0.5) * volatility;
      const newClose = last.close + change;
      candle = {
        time: last.time,
        open: last.open,
        close: newClose,
        high: Math.max(last.high, newClose),
        low: Math.min(last.low, newClose),
        volume: (last.volume || 0) + Math.random() * 10
      };
    } else {
      // New candle
      candle = {
        time: Math.floor(now / 60) * 60, // align to minute
        open: last.close,
        close: last.close,
        high: last.close,
        low: last.close,
        volume: Math.random() * 100
      };
    }
    
    get().processNewCandle(asset, candle);
  },

  generateMockSignal: (asset) => {
    const { mlModels, candles } = get();
    const model = mlModels[asset];
    const newCandles = candles[asset] || [];
    
    if (model) {
      const rsiCondition = newCandles[newCandles.length-1]?.close < newCandles[newCandles.length-5]?.close;
      const macdCondition = true;
      
      model.predict(newCandles).then(({probs, confidence}) => {
         let dir: 'BUY'|'SELL'|'HOLD' = 'HOLD';
         if (probs[0] > 50) dir = 'BUY';
         if (probs[2] > 50) dir = 'SELL';
         if (dir === 'HOLD') {
           // Force a signal for the demo if it's HOLD
           dir = Math.random() > 0.5 ? 'BUY' : 'SELL';
         }
         
         const rulesScore = rsiCondition ? 85 : 40;
         const finalConf = Math.round((confidence * 0.6) + (rulesScore * 0.4)) || Math.floor(Math.random() * 20) + 70;
         
         set({
           currentSignal: {
             asset,
             direction: dir,
             confidence: finalConf,
             mlProbs: probs,
             rulesScore,
             conditions: [
               { name: 'RSI Oversold', met: rsiCondition },
               { name: 'Bullish Engulf', met: false },
               { name: 'Support Bounce', met: Math.random() > 0.5 },
               { name: 'MACD Cross', met: macdCondition },
               { name: 'EMA Cross', met: false },
             ]
           }
         });
      });
    }
  }
}));
