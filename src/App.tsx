/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { useStore } from './store';
import { Sidebar } from './components/Sidebar';
import { Chart } from './components/Chart';
import { SignalPanel } from './components/SignalPanel';
import { StatsBar } from './components/StatsBar';
import { Brain, Wifi, WifiOff } from 'lucide-react';

export default function App() {
  const init = useStore(state => state.init);
  const isWsConnected = useStore(state => state.isWsConnected);
  const selectedAsset = useStore(state => state.selectedAsset);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0e17] text-white overflow-hidden font-sans selection:bg-[#00d4aa] selection:text-[#0a0e17]">
      
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-4 bg-[#1a1f2e] border-b border-[#2a2e39]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00d4aa] to-[#008f72] flex items-center justify-center shadow-[0_0_15px_rgba(0,212,170,0.3)]">
            <Brain className="text-[#0a0e17]" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-wider text-white">POCKET AI ML</h1>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              {isWsConnected ? (
                 <span className="text-[#00d4aa] flex items-center gap-1"><Wifi size={10}/> CONNECTED LIVE</span>
              ) : (
                 <span className="text-yellow-500 flex items-center gap-1"><WifiOff size={10}/> MOCK / RECONNECTING</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-[#0a0e17] border border-[#2a2e39] rounded-lg px-4 py-2 text-sm font-medium">
            {selectedAsset.replace('_OTC', '')} OTC
          </div>
          
          <div className="flex bg-[#0a0e17] border border-[#2a2e39] rounded-lg overflow-hidden">
            {['5s', '15s', '30s', '1M', '3M', '5M', '15M'].map((tf) => (
              <button 
                key={tf}
                className={`px-3 py-2 text-xs font-medium transition-colors ${tf === '1M' ? 'bg-[#202636] text-[#00d4aa]' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <main className="flex-1 relative bg-[#0a0e17]">
          {/* Chart Overlay for ML Predictions? optional */}
          <Chart />
        </main>

        <SignalPanel />
      </div>

      <StatsBar />

    </div>
  );
}
