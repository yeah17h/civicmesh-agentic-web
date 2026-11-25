import React from 'react';
import { KeyRound, X, Cpu, ShieldCheck } from 'lucide-react';
import type { LLMConfig, ProviderPreset } from '../runtime/runtime';

interface LLMConfigModalProps {
  open: boolean;
  onClose: () => void;
  config: LLMConfig;
  onChange: (next: LLMConfig) => void;
  providers: Record<string, ProviderPreset>;
}

export const LLMConfigModal: React.FC<LLMConfigModalProps> = ({
  open,
  onClose,
  config,
  onChange,
  providers
}) => {
  if (!open) return null;

  const currentPreset = providers[config.provider] || providers['demo-deterministic'];

  const handleProviderSelect = (providerId: string) => {
    const preset = providers[providerId];
    onChange({
      provider: providerId,
      apiKey: config.apiKey || '',
      baseUrl: preset.baseUrl,
      model: preset.defaultModel
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-cyan-500/15 p-2 text-cyan-400">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">BYOK LLM & Runtime Configuration</h3>
              <p className="text-xs text-slate-400">
                Keys stay strictly in browser memory — host website incurs $0 inference cost
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

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">LLM Provider / Gateway</label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.values(providers).map((p) => {
                const selected = config.provider === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleProviderSelect(p.id)}
                    className={`rounded-xl border p-3 text-left transition cursor-pointer ${
                      selected
                        ? 'border-cyan-400 bg-cyan-500/10 text-slate-100'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold">{p.label}</span>
                      {!p.requiresKey && (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          No Key
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-400">{p.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {config.provider !== 'demo-deterministic' && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">API Endpoint URL</label>
                <input
                  type="text"
                  value={config.baseUrl ?? currentPreset.baseUrl}
                  onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">Model Name</label>
                  <input
                    type="text"
                    value={config.model ?? currentPreset.defaultModel}
                    onChange={(e) => onChange({ ...config, model: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    API Key {currentPreset.requiresKey ? '(Required for live calls)' : '(Optional)'}
                  </label>
                  <input
                    type="password"
                    placeholder="sk-... or AIza..."
                    value={config.apiKey || ''}
                    onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-[11px] text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>
              Zero-server architecture: your API key is never transmitted to any CivicMesh backend and is stored only in your active browser session.
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3.5">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            Active: <span className="font-semibold text-slate-200">{currentPreset.label}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 cursor-pointer"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};
