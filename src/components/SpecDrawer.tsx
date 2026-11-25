import React, { useState } from 'react';
import { FileJson, X, Copy, Check } from 'lucide-react';
import type { PeerRecord } from '../runtime/runtime';

interface SpecDrawerProps {
  open: boolean;
  onClose: () => void;
  manifest: any;
  hostNetwork: any;
  peers: PeerRecord[];
}

export const SpecDrawer: React.FC<SpecDrawerProps> = ({ open, onClose, manifest, hostNetwork, peers }) => {
  const [activeTab, setActiveTab] = useState<string>('network');
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const tabs: Array<{ id: string; label: string; data: unknown }> = [
    { id: 'manifest', label: 'agent-manifest.json', data: manifest },
    { id: 'network', label: 'agent-network.json (Host)', data: hostNetwork },
    ...peers.map((p) => ({
      id: p.peerId,
      label: `Peer: ${p.peerId}`,
      data: p.network
    }))
  ];

  const current = tabs.find((t) => t.id === activeTab) || tabs[0];
  const jsonText = JSON.stringify(current.data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable in headless mode
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <FileJson className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-slate-100">Open Agentic Web MVS Specification Inspector</h3>
              <p className="text-xs text-slate-400">
                Public, machine-readable JSON files served directly by this static site
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950/60 px-5 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700 cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
        </div>

        <pre className="custom-scrollbar flex-1 overflow-auto bg-[#060b16] p-5 text-xs leading-relaxed text-emerald-200">
          {jsonText}
        </pre>
      </div>
    </div>
  );
};
