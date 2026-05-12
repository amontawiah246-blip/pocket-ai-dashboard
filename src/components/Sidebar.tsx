import React from 'react';
import { useStore } from '../store';
import { formatPrice, formatPercent, cn } from '../lib/utils';
import { Plus } from 'lucide-react';

export function Sidebar() {
  const assets = useStore(state => state.assets);
  const selectedAsset = useStore(state => state.selectedAsset);
  const setSelectedAsset = useStore(state => state.setSelectedAsset);

  return (
    <div className="w-64 bg-[#1a1f2e] border-r border-[#2a2e39] flex flex-col h-full">
      <div className="p-4 border-b border-[#2a2e39] text-sm font-semibold text-gray-400">
        ASSETS
      </div>
      <div className="flex-1 overflow-y-auto">
        {assets.map((asset) => (
          <div
            key={asset.name}
            onClick={() => setSelectedAsset(asset.name)}
            className={cn(
              "p-4 cursor-pointer hover:bg-[#202636] transition-colors border-l-2",
              selectedAsset === asset.name ? "border-[#00d4aa] bg-[#202636]" : "border-transparent"
            )}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-white flex items-center gap-2">
                {asset.name.replace('_OTC', '')}
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  asset.change > 0 ? "bg-[#00d4aa]" : asset.change < 0 ? "bg-[#ff4757]" : "bg-gray-500"
                )}></span>
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-300">{formatPrice(asset.price)}</span>
              <span className={asset.change >= 0 ? "text-[#00d4aa]" : "text-[#ff4757]"}>
                {formatPercent(asset.change)}
              </span>
            </div>
          </div>
        ))}
        
        <button className="w-full p-4 text-center text-[#00d4aa] hover:bg-[#202636] transition-colors flex items-center justify-center gap-2 text-sm font-medium">
          <Plus size={16} /> ADD MORE
        </button>
      </div>
    </div>
  );
}
