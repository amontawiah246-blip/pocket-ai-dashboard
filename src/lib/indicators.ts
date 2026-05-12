// Basic Technical Indicators

export type Candle = {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

// EMA
export function calculateEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema = [data[0]];
  for (let i = 1; i < data.length; i++) {
    ema.push(data[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

// RSI
export function calculateRSI(data: number[], period: number = 14): number[] {
  const rsi = new Array(data.length).fill(0);
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  if(avgLoss === 0) rsi[period] = 100;
  else rsi[period] = 100 - (100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if(avgLoss === 0) rsi[i] = 100;
    else rsi[i] = 100 - (100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

// MACD
export function calculateMACD(data: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEma = calculateEMA(data, fastPeriod);
  const slowEma = calculateEMA(data, slowPeriod);
  
  const macdLine = data.map((_, i) => fastEma[i] - slowEma[i]);
  const signalLine = calculateEMA(macdLine, signalPeriod);
  const histogram = macdLine.map((val, i) => val - signalLine[i]);

  return { macdLine, signalLine, histogram };
}

// Bollinger Bands
export function calculateBollingerBands(data: number[], period = 20, multiplier = 2) {
  const sma = [];
  const upper = [];
  const lower = [];

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(data[i]);
      upper.push(data[i]);
      lower.push(data[i]);
      continue;
    }

    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    const avg = sum / period;
    
    const squaredDiffs = slice.map(val => Math.pow(val - avg, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(variance);

    sma.push(avg);
    upper.push(avg + stdDev * multiplier);
    lower.push(avg - stdDev * multiplier);
  }

  return { sma, upper, lower };
}

// Stochastic Oscillator
export function calculateStochastic(highs: number[], lows: number[], closes: number[], kPeriod = 14, dPeriod = 3) {
  const kLine = new Array(closes.length).fill(50);
  
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const highestHigh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
    const lowestLow = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
    if (highestHigh - lowestLow === 0) {
      kLine[i] = 50;
    } else {
      kLine[i] = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
    }
  }

  const dLine = calculateEMA(kLine, dPeriod);
  return { kLine, dLine };
}

// Extract full feature set for a single candle given history
export function extractFeatures(candles: Candle[]): number[] {
  if (candles.length < 60) return new Array(30).fill(0); // Need enough history

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const opens = candles.map(c => c.open);
  const volumes = candles.map(c => c.volume || 0);

  const currentIdx = candles.length - 1;
  const c = candles[currentIdx];
  const prevC = candles[currentIdx - 1];

  // 1. Normalized OHLCV
  const maxPrice = Math.max(...highs.slice(-60));
  const minPrice = Math.min(...lows.slice(-60));
  const range = maxPrice - minPrice || 1;
  
  const normO = (c.open - minPrice) / range;
  const normH = (c.high - minPrice) / range;
  const normL = (c.low - minPrice) / range;
  const normC = (c.close - minPrice) / range;
  const maxVol = Math.max(...volumes.slice(-60)) || 1;
  const normV = (c.volume || 0) / maxVol;

  // 2. Price change %
  const priceChangePct = (c.close - prevC.close) / prevC.close;

  // 3. Candle body size
  // Simple ATR for last 14
  const atrSlice = candles.slice(-15);
  let trSum = 0;
  for(let i=1; i<atrSlice.length; i++) {
    const tr = Math.max(
      atrSlice[i].high - atrSlice[i].low,
      Math.abs(atrSlice[i].high - atrSlice[i-1].close),
      Math.abs(atrSlice[i].low - atrSlice[i-1].close)
    );
    trSum += tr;
  }
  const atr = trSum / 14 || 1;
  const bodySizeAttr = Math.abs(c.close - c.open) / atr;

  // 4. Wick ratios
  const bodyTop = Math.max(c.open, c.close);
  const bodyBottom = Math.min(c.open, c.close);
  const totalLength = c.high - c.low || 1;
  const upperWickRatio = (c.high - bodyTop) / totalLength;
  const lowerWickRatio = (bodyBottom - c.low) / totalLength;

  // 5. RSI
  const rsiArr = calculateRSI(closes, 14);
  const rsi = rsiArr[rsiArr.length - 1] / 100; // Normalize 0-1

  // 6. MACD
  const { macdLine, signalLine, histogram } = calculateMACD(closes);
  const macdIdx = macdLine.length - 1;
  // Normalize MACD roughly
  const normMacd = Math.tanh(macdLine[macdIdx] * 1000);
  const normSignal = Math.tanh(signalLine[macdIdx] * 1000);
  const normHist = Math.tanh(histogram[macdIdx] * 1000);

  // 7. Stochastic
  const { kLine, dLine } = calculateStochastic(highs, lows, closes);
  const normK = kLine[kLine.length - 1] / 100;
  const normD = dLine[dLine.length - 1] / 100;

  // 8. Bollinger Bands
  const { upper, lower } = calculateBollingerBands(closes, 20);
  const up = upper[upper.length - 1];
  const dn = lower[lower.length - 1];
  const bbWidth = (up - dn) / c.close;
  const bbPos = up !== dn ? (c.close - dn) / (up - dn) : 0.5;

  // 9. EMA diff
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const emaDiff = (ema9[ema9.length - 1] - ema21[ema21.length - 1]) / c.close;

  // 10. Distance from 20-period H/L
  const highest20 = Math.max(...highs.slice(-20));
  const lowest20 = Math.min(...lows.slice(-20));
  const distHigh = (highest20 - c.close) / c.close;
  const distLow = (c.close - lowest20) / c.close;

  // 11. Vol change
  const volChange = prevC.volume ? ((c.volume || 0) - prevC.volume) / prevC.volume : 0;
  const normVolChange = Math.tanh(volChange);

  // 12. Patterns (One Hot)
  const isDoji = Math.abs(c.close - c.open) <= (c.high - c.low) * 0.1 ? 1 : 0;
  const isHammer = lowerWickRatio > 0.6 && upperWickRatio < 0.1 ? 1 : 0;
  const isShootingStar = upperWickRatio > 0.6 && lowerWickRatio < 0.1 ? 1 : 0;
  
  const isBull = c.close > c.open;
  const prevIsBear = prevC.open > prevC.close;
  const isEngulfingBull = isBull && prevIsBear && c.open < prevC.close && c.close > prevC.open ? 1 : 0;
  const isEngulfingBear = !isBull && !prevIsBear && c.open > prevC.close && c.close < prevC.open ? 1 : 0;
  
  // Simplified 3-candle patterns
  const isMorningStar = 0; // Requires 3 candles, simplifying for now or add full logic
  const isEveningStar = 0;
  const isMarubozu = bodySizeAttr > 2 && upperWickRatio < 0.05 && lowerWickRatio < 0.05 ? 1 : 0;

  return [
    normO, normH, normL, normC, normV, // 5
    priceChangePct, bodySizeAttr, upperWickRatio, lowerWickRatio, // 4
    rsi, normMacd, normSignal, normHist, // 4
    normK, normD, bbWidth, bbPos, emaDiff, // 5
    distHigh, distLow, normVolChange, // 3
    isDoji, isHammer, isShootingStar, isEngulfingBull, isEngulfingBear, isMorningStar, isEveningStar, isMarubozu, // 8
    0 // Pad to 30 just in case
  ].slice(0, 30);
}
