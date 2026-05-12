import * as tf from '@tensorflow/tfjs';
import { extractFeatures, type Candle } from '../lib/indicators';

const SEQUENCE_LENGTH = 60;
const PREDICTION_HORIZON = 3;
const THRESHOLD = 0.0005; // 0.05%

export class MLService {
  private model: tf.Sequential | tf.LayersModel | null = null;
  public asset: string;
  public timeframe: string;
  public isTraining = false;
  public trainingProgress = 0;
  
  public accuracy = 50;
  public winRate = 50;
  public totalTrades = 0;
  private predictionHistory: { actual?: number, pred: number }[] = [];

  constructor(asset: string, timeframe: string) {
    this.asset = asset;
    this.timeframe = timeframe;
  }

  async buildModel() {
    const model = tf.sequential();
    
    // LSTM Layer 1
    model.add(tf.layers.lstm({
      units: 128,
      inputShape: [SEQUENCE_LENGTH, 30],
      returnSequences: true
    }));
    model.add(tf.layers.dropout({ rate: 0.3 }));
    
    // LSTM Layer 2
    model.add(tf.layers.lstm({
      units: 128,
      returnSequences: false
    }));
    model.add(tf.layers.dropout({ rate: 0.3 }));

    // Dense output [BUY, HOLD, SELL]
    model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.model = model;
    console.log(`Model built for ${this.asset} ${this.timeframe}`);
  }

  async loadModel() {
    try {
      const modelPath = `indexeddb://pocket_ai_model_${this.asset}_${this.timeframe}`;
      this.model = await tf.loadLayersModel(modelPath);
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
      console.log(`Loaded model for ${this.asset}`);
      return true;
    } catch (e) {
      console.log(`No saved model found for ${this.asset}, creating new.`);
      await this.buildModel();
      return false;
    }
  }

  async saveModel() {
    if (!this.model) return;
    try {
      const modelPath = `indexeddb://pocket_ai_model_${this.asset}_${this.timeframe}`;
      await this.model.save(modelPath);
      console.log(`Saved model for ${this.asset}`);
    } catch (e) {
      console.error('Error saving model', e);
    }
  }

  prepareData(candles: Candle[]) {
    if (candles.length < SEQUENCE_LENGTH + PREDICTION_HORIZON) return null;

    const xs = [];
    const ys = [];

    // Need to build features for every candle
    // Doing it efficiently:
    const allFeatures = [];
    for (let i = SEQUENCE_LENGTH; i <= candles.length; i++) {
        allFeatures.push(extractFeatures(candles.slice(i - SEQUENCE_LENGTH, i)));
    }

    for (let i = SEQUENCE_LENGTH; i < candles.length - PREDICTION_HORIZON; i++) {
      const seqXs = [];
      // Grab 60 sequence of features
      for (let j = 0; j < SEQUENCE_LENGTH; j++) {
        seqXs.push(allFeatures[i - SEQUENCE_LENGTH + j] || new Array(30).fill(0));
      }
      
      const currentPrice = candles[i].close;
      const futurePrice = candles[i + PREDICTION_HORIZON].close;
      const pctChange = (futurePrice - currentPrice) / currentPrice;

      let label = [0, 1, 0]; // HOLD default
      if (pctChange > THRESHOLD) label = [1, 0, 0]; // BUY
      if (pctChange < -THRESHOLD) label = [0, 0, 1]; // SELL

      xs.push(seqXs);
      ys.push(label);
    }

    if (xs.length === 0) return null;

    return {
      xs: tf.tensor3d(xs),
      ys: tf.tensor2d(ys)
    };
  }

  async train(candles: Candle[], onProgress: (p: number) => void) {
    if (this.isTraining || !this.model) return;
    const data = this.prepareData(candles);
    if (!data) return;

    this.isTraining = true;
    try {
      await this.model.fit(data.xs, data.ys, {
        epochs: 20,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
             const prog = Math.round(((epoch + 1) / 20) * 100);
             onProgress(prog);
             this.trainingProgress = prog;
             if (logs?.val_acc !== undefined) {
               this.accuracy = Math.round(logs.val_acc * 100);
             }
          }
        }
      });
      await this.saveModel();
    } catch (e) {
      console.error('Training failed', e);
    } finally {
      this.isTraining = false;
      this.trainingProgress = 0;
      data.xs.dispose();
      data.ys.dispose();
    }
  }

  async predict(candles: Candle[]): Promise<{ probs: number[], confidence: number }> {
    if (!this.model || candles.length < SEQUENCE_LENGTH) return { probs: [0, 100, 0], confidence: 0 };
    
    tf.engine().startScope();
    try {
      const seq = [];
      for (let j = 0; j < SEQUENCE_LENGTH; j++) {
        seq.push(extractFeatures(candles.slice(candles.length - SEQUENCE_LENGTH - SEQUENCE_LENGTH + j, candles.length - SEQUENCE_LENGTH + j)) || new Array(30).fill(0));
      }
      
      // The previous block is slightly off, we just need the LAST 60 features.
      const lastSeqFeatures = [];
      for(let j=SEQUENCE_LENGTH; j > 0; j--) {
        lastSeqFeatures.push(extractFeatures(candles.slice(candles.length - SEQUENCE_LENGTH - j, candles.length - j)));
      }

      const input = tf.tensor3d([lastSeqFeatures]);
      const pred = this.model.predict(input) as tf.Tensor;
      const data = await pred.data();
      const probs = Array.from(data).map(d => Math.round(d * 100)); // Buy, Hold, Sell
      return { probs, confidence: Math.max(...probs) };
    } finally {
      tf.engine().endScope();
    }
  }
}
