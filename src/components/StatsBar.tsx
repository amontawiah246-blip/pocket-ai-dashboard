import React from 'react';
import { useStore } from '../store';
import { BrainCircuit, Clock, Settings, TrendingUp } from 'lucide-react';

export function StatsBar() {
  const stats = useStore(state => state.globalStats);
  const selectedAsset = useStore(state => state.selectedAsset);
  const mlModel = useStore(state => state.mlModels[selectedAsset]);

  // Determine ML state color
  let mlColor = "bg-gray-500";
  if (mlModel?.isTraining) mlColor = "bg-yellow-500 animate-pulse";
  else if (mlModel?.accuracy > 65) mlColor = "bg-[#00d4aa]";
  else if (mlModel?.accuracy > 0) mlColor = "bg-white";

  return (
    <div className="h-14 bg-[#1a1f2e] border-t border-[#2a2e39] flex items-center justify-between px-6 text-sm text-gray-400">
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <BrainCircuit size={16} className="text-[#00d4aa]"/>
          <span className="font-semibold text-gray-300">MODEL STATS:</span>
          <span>Accuracy: <span className="text-white">{stats.accuracy}%</span></span>
          <span>Win Rate: <span className="text-white">{stats.winRate}%</span></span>
          <span>Trades: <span className="text-white">{stats.trades}</span></span>
        </div>
        
        <div className="w-px h-4 bg-[#2a2e39]"></div>
        
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1"><Clock size={14}/> Next candle: 00:03</span>
        </div>
      </div>

      <div className="flex items-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span>INDICATORS:</span>
          <span className="text-[#00d4aa] flex items-center gap-1">☑ BB</span>
          <span className="text-[#00d4aa] flex items-center gap-1">☑ RSI</span>
          <span className="text-[#00d4aa] flex items-center gap-1">☑ MACD</span>
          <span className="flex items-center gap-1">☐ STOCH</span>
        </div>
        
        <div className="w-px h-4 bg-[#2a2e39]"></div>

        <div className="flex items-center gap-4">
           <span>ACTIVE: <span className="text-white">0</span></span>
           <span className="flex items-center gap-1">
             TODAY: <span className="text-[#00d4aa] flex items-center"><TrendingUp size={12} className="mr-1"/> +${stats.todayPnl.toFixed(2)} (+{stats.todayPct}%)</span>
           </span>
           <span className="flex items-center gap-2 text-gray-500 bg-[#0a0e17] px-2 py-1 rounded">
             <div className={`w-2 h-2 rounded-full ${mlColor}`}></div>
             MODEL v2.4
           </span>
        </div>
      </div>
      
    </div>
  );
}
