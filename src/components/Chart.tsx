import React, { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickSeries } from 'lightweight-charts';
import { useStore } from '../store';

export function Chart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  
  const selectedAsset = useStore(state => state.selectedAsset);
  const candles = useStore(state => state.candles[selectedAsset]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#1a1f2e' },
        textColor: '#8b9bb4',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.5)' },
      },
      crosshair: {
        mode: 0,
      },
      rightPriceScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
      },
      timeScale: {
        borderColor: 'rgba(42, 46, 57, 0.5)',
        timeVisible: true,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#00d4aa',
      downColor: '#ff4757',
      borderDownColor: '#ff4757',
      borderUpColor: '#00d4aa',
      wickDownColor: '#ff4757',
      wickUpColor: '#00d4aa',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (seriesRef.current && candles && candles.length > 0) {
      // Lightweight charts requires unique time per candle, formatted strictly.
      // We must ensure time is strictly increasing.
      try {
        const formattedData = candles.map(c => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })).sort((a,b) => a.time - b.time);
        
        // Remove duplicates
        const unique = [];
        let lastTime = 0;
        for (const item of formattedData) {
          if (item.time > lastTime) {
            unique.push(item);
            lastTime = item.time;
          } else if (item.time === lastTime) {
              unique[unique.length - 1] = item; // override last
          }
        }
        
        seriesRef.current.setData(unique);
      } catch (err) {
        console.error("Chart data error", err);
      }
    }
  }, [candles, selectedAsset]);

  return (
    <div className="w-full h-full relative" ref={chartContainerRef}>
       <div className="absolute top-4 left-4 z-10 flex gap-2">
         {/* Could add indicator toggles here */}
       </div>
    </div>
  );
}
