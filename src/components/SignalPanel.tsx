import React from 'react';
import { useStore } from '../store';
import { Bot, CheckSquare, Square, ChevronUp, ChevronDown, Activity, Layers, Target } from 'lucide-react';
import { cn } from '../lib/utils';

export function SignalPanel() {
  const signal = useStore(state => state.currentSignal);
  const selectedAsset = useStore(state => state.selectedAsset);
  const mlModel = useStore(state => state.mlModels[selectedAsset]);

  return (
    <div className="w-80 bg-[#1a1f2e] border-l border-[#2a2e39] flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-[#2a2e39] flex items-center gap-2 font-semibold text-gray-300">
        <Bot className="text-[#00d4aa]" size={20} />
        AI SIGNAL
      </div>

      <div className="p-6">
        {!signal ? (
          <div className="flex flex-col h-full justify-center">
            <div className="text-center text-gray-500 py-8 mb-4">
              <Activity className="mx-auto mb-4 opacity-50 text-[#00d4aa]" size={48} />
              <p className="text-lg text-gray-300 font-medium mb-1">Ready to Analyze</p>
              <p className="text-sm">Click below to start ML prediction</p>
              {mlModel?.isTraining && (
                 <p className="text-yellow-500 text-xs mt-4 bg-yellow-500/10 py-1 px-2 rounded inline-block">Training model: {mlModel.trainingProgress}%</p>
              )}
            </div>
            
            <button 
              onClick={() => useStore.getState().generateMockSignal(selectedAsset)}
              className="w-full py-4 rounded-lg font-bold text-lg text-[#0a0e17] bg-[#00d4aa] shadow-[0_0_15px_rgba(0,212,170,0.4)] transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
            >
              <Target size={20} /> GET SIGNAL
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col items-center p-6 bg-[#0a0e17] rounded-xl border border-[#2a2e39]">
               <div className={cn(
                 "text-4xl font-bold flex items-center gap-2 mb-2",
                 signal.direction === 'BUY' ? "text-[#00d4aa]" : signal.direction === 'SELL' ? "text-[#ff4757]" : "text-gray-400"
               )}>
                  {signal.direction}
                  {signal.direction === 'BUY' && <ChevronUp size={36} />}
                  {signal.direction === 'SELL' && <ChevronDown size={36} />}
               </div>
               <div className="text-lg text-gray-300 font-medium">
                 {signal.confidence}% confidence
               </div>
            </div>

            <div className="space-y-3">
               <div className="flex justify-between text-sm">
                 <span className="text-gray-400 flex items-center gap-2"><Layers size={14}/> ML Model:</span>
                 <span className={signal.mlProbs[0] > signal.mlProbs[2] ? "text-[#00d4aa]" : "text-[#ff4757]"}>
                   {Math.max(signal.mlProbs[0], signal.mlProbs[2])}% {signal.mlProbs[0] > signal.mlProbs[2] ? 'BUY' : 'SELL'}
                 </span>
               </div>
               <div className="flex justify-between text-sm">
                 <span className="text-gray-400 flex items-center gap-2"><Target size={14}/> Rules Engine:</span>
                 <span className={signal.direction === 'BUY' ? "text-[#00d4aa]" : "text-[#ff4757]"}>
                   {signal.rulesScore}% {signal.direction}
                 </span>
               </div>
            </div>

            <div className="pt-4 border-t border-[#2a2e39]">
              <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Conditions</h4>
              <div className="space-y-2">
                {signal.conditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-gray-300">
                    {c.met ? <CheckSquare className="text-[#00d4aa]" size={16} /> : <Square className="text-gray-600" size={16} />}
                    <span className={c.met ? "text-gray-200" : "text-gray-500"}>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className={cn(
              "w-full py-4 rounded-lg font-bold text-lg text-white transition-all transform hover:scale-[1.02]",
              signal.direction === 'BUY' ? "bg-[#00d4aa] shadow-[0_0_15px_rgba(0,212,170,0.4)]" : 
              signal.direction === 'SELL' ? "bg-[#ff4757] shadow-[0_0_15px_rgba(255,71,87,0.4)]" : 
              "bg-gray-600"
            )}>
               GET SIGNAL
            </button>
            
            {mlModel?.accuracy && (
              <div className="text-xs text-center text-gray-500 mt-2">
                Model specific acc: {mlModel.accuracy}%
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
