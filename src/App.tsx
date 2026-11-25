import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileJson,
  Globe2,
  HeartHandshake,
  KeyRound,
  Link2,
  Package,
  Play,
  PlusCircle,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Truck,
  Zap
} from 'lucide-react';
import { bootAgenticWebRunner } from './runtime/runner.js';
import { LLM_PROVIDER_PRESETS } from './runtime/llmClient.js';
import type {
  AgenticWebEngine,
  ApprovalRequest,
  LLMConfig,
  PeerRecord,
  TraceEvent
} from './runtime/runtime';
import {
  DEMO_SCENARIOS,
  INITIAL_SHELTERS,
  INITIAL_SUPPLIES,
  INITIAL_TICKETS,
  type ActivityTicket,
  type Shelter,
  type SupplyItem
} from './data/reliefData';
import { NetworkTopology } from './components/NetworkTopology';
import { ApprovalModal } from './components/ApprovalModal';
import { LLMConfigModal } from './components/LLMConfigModal';
import { SpecDrawer } from './components/SpecDrawer';

export default function App() {
  const [shelters, setShelters] = useState<Shelter[]>(INITIAL_SHELTERS);
  const [supplies, setSupplies] = useState<SupplyItem[]>(INITIAL_SUPPLIES);
  const [tickets, setTickets] = useState<ActivityTicket[]>(INITIAL_TICKETS);
  const [highlightedShelterId, setHighlightedShelterId] = useState<string | null>(null);

  const sheltersRef = useRef<Shelter[]>(INITIAL_SHELTERS);
  const suppliesRef = useRef<SupplyItem[]>(INITIAL_SUPPLIES);
  sheltersRef.current = shelters;
  suppliesRef.current = supplies;

  const engineRef = useRef<AgenticWebEngine | null>(null);
  const approvalResolverRef = useRef<((approved: boolean) => void) | null>(null);

  const [manifest, setManifest] = useState<any>(null);
  const [hostNetwork, setHostNetwork] = useState<any>(null);
  const [hostDigest, setHostDigest] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerRecord[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);

  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);

  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'demo-deterministic',
    model: LLM_PROVIDER_PRESETS['demo-deterministic'].defaultModel
  });
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [specDrawerOpen, setSpecDrawerOpen] = useState(false);

  const [promptInput, setPromptInput] = useState(DEMO_SCENARIOS[0].prompt);
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{
    summary: string;
    usedProvider: string;
    model: string;
    observations: Record<string, any>;
    actionOutcomes: Array<{ status: string; action: string; message: string; data?: any }>;
  } | null>(null);

  const [bottomTab, setBottomTab] = useState<'trace' | 'peers'>('trace');
  const [customPeerUrl, setCustomPeerUrl] = useState('./peers/volunteer-network/agent-network.json');
  const [peerConnectMsg, setPeerConnectMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const { engine, bootstrap } = await bootAgenticWebRunner({
          manifestUrl: './agent-manifest.json',
          stepDelayMs: 240,
          onTrace: (evt) => {
            if (!cancelled) {
              setTraces((prev) => [evt, ...prev].slice(0, 60));
            }
          },
          onNodeActive: (nodeId) => {
            if (!cancelled) setActiveNode(nodeId);
          },
          onApprovalRequired: (req) =>
            new Promise<boolean>((resolve) => {
              approvalResolverRef.current = resolve;
              setPendingApproval(req);
            }),
          siteActions: {
            query_shelters: async (args: {
              district: string;
              needs_wheelchair?: boolean;
              needs_power?: boolean;
              needs_pets?: boolean;
              min_beds?: number;
            }) => {
              const current = sheltersRef.current;
              const matches = current
                .filter((s) => {
                  if (args.district !== 'Any' && s.district !== args.district) return false;
                  if (args.needs_wheelchair && !s.wheelchair_accessible) return false;
                  if (args.needs_power && !s.backup_power) return false;
                  if (args.needs_pets && !s.pet_friendly) return false;
                  if (args.min_beds && s.available_beds < args.min_beds) return false;
                  return true;
                })
                .sort((a, b) => b.available_beds - a.available_beds);

              return {
                matches,
                summary:
                  matches.length > 0
                    ? `Matched ${matches.length} open shelters (top: ${matches[0].name} with ${matches[0].available_beds} beds)`
                    : 'No shelters matched all constraints'
              };
            },
            check_supply_inventory: async (args: { item: string }) => {
              const current = suppliesRef.current;
              const items = args.item === 'all' ? current : current.filter((i) => i.key === args.item);
              return {
                items,
                summary: items.map((i) => `${i.label}: ${i.quantity} (${i.hub})`).join('; ')
              };
            },
            reserve_shelter_bed: async (args: {
              shelter_id: string;
              party_size: number;
              resident_alias: string;
              accessibility_notes?: string;
            }) => {
              const target = sheltersRef.current.find((s) => s.id === args.shelter_id);
              if (!target) {
                throw new Error(`Shelter ${args.shelter_id} not found`);
              }
              if (target.available_beds < args.party_size) {
                throw new Error(`Insufficient beds at ${target.name}`);
              }

              setShelters((prev) =>
                prev.map((s) => {
                  if (s.id !== args.shelter_id) return s;
                  const remaining = Math.max(0, s.available_beds - args.party_size);
                  return {
                    ...s,
                    available_beds: remaining,
                    status: remaining <= 10 ? 'NEAR_CAPACITY' : 'OPEN'
                  };
                })
              );

              const ticketId = `RSV-${Math.floor(1000 + Math.random() * 9000)}`;
              const newTicket: ActivityTicket = {
                id: ticketId,
                kind: 'RESERVATION',
                shelterId: target.id,
                shelterName: target.name,
                summary: `Reserved ${args.party_size} bed(s) for ${args.resident_alias}${
                  args.accessibility_notes ? ` (${args.accessibility_notes})` : ''
                }`,
                timestamp: new Date().toISOString().slice(11, 16) + ' UTC',
                approvedByHuman: true
              };
              setTickets((prev) => [newTicket, ...prev]);
              setHighlightedShelterId(target.id);
              setTimeout(() => setHighlightedShelterId(null), 3000);

              return {
                ticket_id: ticketId,
                shelter_id: target.id,
                remaining_beds: target.available_beds - args.party_size,
                summary: `Ticket ${ticketId}: Held ${args.party_size} bed(s) at ${target.name} (${target.id})`
              };
            },
            create_aid_dispatch: async (args: {
              destination_shelter_id: string;
              supply_item: string;
              quantity: number;
              priority: string;
              notes?: string;
            }) => {
              const target = sheltersRef.current.find((s) => s.id === args.destination_shelter_id);
              const supply = suppliesRef.current.find((i) => i.key === args.supply_item);
              if (!target || !supply) {
                throw new Error('Invalid destination shelter or supply item');
              }

              setSupplies((prev) =>
                prev.map((i) =>
                  i.key === args.supply_item ? { ...i, quantity: Math.max(0, i.quantity - args.quantity) } : i
                )
              );

              const ticketId = `DSP-${Math.floor(1000 + Math.random() * 9000)}`;
              const newTicket: ActivityTicket = {
                id: ticketId,
                kind: 'DISPATCH',
                shelterId: target.id,
                shelterName: target.name,
                summary: `Dispatched ${args.quantity}× ${supply.label} (${args.priority})`,
                priority: args.priority,
                timestamp: new Date().toISOString().slice(11, 16) + ' UTC',
                approvedByHuman: true
              };
              setTickets((prev) => [newTicket, ...prev]);
              setHighlightedShelterId(target.id);
              setTimeout(() => setHighlightedShelterId(null), 3000);

              return {
                ticket_id: ticketId,
                summary: `Ticket ${ticketId}: Dispatched ${args.quantity}× ${supply.label} to ${target.name} [${args.priority}]`
              };
            }
          }
        });

        if (!cancelled) {
          engineRef.current = engine;
          setManifest(bootstrap.manifest);
          setHostNetwork(bootstrap.hostNetwork);
          setHostDigest(bootstrap.hostDigest);
          setPeers(bootstrap.peers);
        }
      } catch (err: any) {
        if (!cancelled) {
          setBootError(err?.message || 'Failed to initialize Open Agentic Web runtime');
        }
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleApprovalDecision = (approved: boolean) => {
    setPendingApproval(null);
    if (approvalResolverRef.current) {
      approvalResolverRef.current(approved);
      approvalResolverRef.current = null;
    }
  };

  const handleRun = async (customText?: string) => {
    const query = (customText ?? promptInput).trim();
    if (!query || !engineRef.current || isRunning) return;
    setPromptInput(query);
    setIsRunning(true);
    setBottomTab('trace');
    try {
      const result = await engineRef.current.runRequest(query, llmConfig);
      setLastResult(result);
    } catch (err: any) {
      setLastResult({
        summary: `### Runtime Blocked Request\n- ${err?.message || 'Unknown error'}`,
        usedProvider: llmConfig.provider,
        model: llmConfig.model || 'n/a',
        observations: {},
        actionOutcomes: []
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSchemaGuardTest = async () => {
    if (!engineRef.current || isRunning) return;
    setBottomTab('trace');
    const res = await engineRef.current.demonstrateSchemaGuard();
    setLastResult({
      summary:
        `### MVS Strict JSON Schema Guard Demonstrated\n` +
        `- Attempted to call \`${res.action}\` with malformed payload (\`shelter_id: "INVALID_ID_999"\`, \`party_size: 42\`, injected unknown field).\n` +
        `- **Result**: Blocked client-side BEFORE HITL modal or host state handler was reached.\n` +
        `- **Validation Errors**: ${res.errors.join(' | ')}`,
      usedProvider: 'schema-guard',
      model: 'strict-json-schema-validator',
      observations: {},
      actionOutcomes: [{ status: 'schema_rejected', action: res.action, message: res.message }]
    });
  };

  const handleConnectCustomPeer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engineRef.current || !customPeerUrl.trim()) return;
    setPeerConnectMsg(null);
    try {
      const record = await engineRef.current.connectPeer(customPeerUrl.trim(), { isCustom: true });
      setPeers(Array.from(engineRef.current.peers.values()));
      setPeerConnectMsg({
        kind: 'ok',
        text: `Connected & verified "${record.network.name}" (${record.digest})`
      });
    } catch (err: any) {
      setPeerConnectMsg({
        kind: 'err',
        text: err?.message || 'Failed to load external peer agent-network.json'
      });
    }
  };

  const totalOpenBeds = shelters.reduce((sum, s) => sum + s.available_beds, 0);
  const activeProviderLabel =
    LLM_PROVIDER_PRESETS[llmConfig.provider as keyof typeof LLM_PROVIDER_PRESETS]?.label || llmConfig.provider;

  return (
    <div className="min-h-screen bg-[#070d19] text-slate-100">
      {/* Top Navigation & Spec Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20">
              <Globe2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight text-white">CivicMesh</h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                  Open Agentic Web · MVS 0.1
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Federated Disaster & Community Relief Coordination — 100% Browser Runtime
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSchemaGuardTest}
              data-testid="schema-guard-btn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 cursor-pointer"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Test Schema Guard
            </button>

            <button
              type="button"
              onClick={() => setSpecDrawerOpen(true)}
              data-testid="inspect-spec-btn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-emerald-500/50 hover:text-emerald-300 cursor-pointer"
            >
              <FileJson className="h-3.5 w-3.5 text-emerald-400" />
              Inspect MVS JSON
            </button>

            <button
              type="button"
              onClick={() => setLlmModalOpen(true)}
              data-testid="byok-config-btn"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 cursor-pointer"
            >
              <KeyRound className="h-3.5 w-3.5 text-cyan-400" />
              <span>BYOK LLM:</span>
              <span className="max-w-[130px] truncate text-cyan-300">
                {llmConfig.provider === 'demo-deterministic' ? 'Zero-Key Demo' : activeProviderLabel}
              </span>
            </button>
          </div>
        </div>
      </header>

      {bootError && (
        <div className="mx-auto mt-4 max-w-[1440px] px-4 sm:px-6">
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            Runtime bootstrap error: {bootError}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <main className="mx-auto grid max-w-[1440px] grid-cols-1 gap-5 px-4 py-5 sm:px-6 lg:grid-cols-12">
        {/* LEFT COLUMN (4 cols): Live Host Website Relief State */}
        <section className="space-y-4 lg:col-span-4">
          {/* Live KPI Summary */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              <div className="text-[11px] font-medium text-slate-400">Open Beds</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-400" data-testid="total-open-beds">
                {totalOpenBeds}
              </div>
              <div className="text-[10px] text-slate-500">Across 4 shelters</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              <div className="text-[11px] font-medium text-slate-400">Federated Peers</div>
              <div className="mt-1 text-2xl font-extrabold text-cyan-400" data-testid="peer-count">
                {peers.length}
              </div>
              <div className="text-[10px] text-slate-500">SHA-256 verified</div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
              <div className="text-[11px] font-medium text-slate-400">HITL Tickets</div>
              <div className="mt-1 text-2xl font-extrabold text-amber-400" data-testid="ticket-count">
                {tickets.length}
              </div>
              <div className="text-[10px] text-slate-500">Human approved</div>
            </div>
          </div>

          {/* Live Shelter Directory */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                  Host Site · Live Community Shelters
                </h2>
              </div>
              <span className="text-[10px] text-slate-400">Mutated via HITL write actions</span>
            </div>

            <div className="space-y-2.5">
              {shelters.map((s) => {
                const highlighted = highlightedShelterId === s.id;
                return (
                  <div
                    key={s.id}
                    data-testid={`shelter-card-${s.id}`}
                    className={`rounded-lg border p-3 transition-all ${
                      highlighted
                        ? 'border-emerald-400 bg-emerald-500/15 shadow-lg shadow-emerald-500/10'
                        : 'border-slate-800 bg-slate-950/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-100">{s.name}</span>
                          <code className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                            {s.id}
                          </code>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400">{s.district} District</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-extrabold text-emerald-400">
                          {s.available_beds} <span className="text-[10px] font-normal text-slate-400">/ {s.total_beds}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">beds open</div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                      {s.wheelchair_accessible && (
                        <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-cyan-300">Wheelchair ADA</span>
                      )}
                      {s.backup_power && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">Backup Power</span>
                      )}
                      {s.pet_friendly && (
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-300">Pet Friendly</span>
                      )}
                      {s.status === 'NEAR_CAPACITY' && (
                        <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-300">Near Capacity</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Emergency Supply Stock */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Package className="h-4 w-4 text-cyan-400" />
              <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                Host Site · Supply Inventory
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {supplies.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/60 px-3 py-2 text-xs"
                >
                  <div>
                    <span className="font-medium text-slate-200">{item.label}</span>
                    <span className="ml-2 text-[10px] text-slate-500">{item.hub}</span>
                  </div>
                  <span className="font-mono font-bold text-cyan-300">{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Approved Reservations & Dispatches */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <Truck className="h-4 w-4 text-amber-400" />
              <h2 className="text-xs font-bold tracking-wider text-slate-200 uppercase">
                Approved Action Ledger
              </h2>
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto custom-scrollbar pr-1">
              {tickets.map((tk) => (
                <div
                  key={tk.id}
                  data-testid={`ticket-${tk.id}`}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {tk.id} · {tk.kind}
                    </span>
                    <span className="text-[10px] text-slate-500">{tk.timestamp}</span>
                  </div>
                  <p className="mt-1 text-slate-300">{tk.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN (8 cols): Topology + Coordinator Console + Trace & Peer Federation */}
        <section className="space-y-4 lg:col-span-8">
          {/* Live SVG Network Topology */}
          <NetworkTopology activeNode={activeNode} hostDigest={hostDigest} peers={peers} />

          {/* Agent Command Console */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-100">
                  Relief Coordinator Console
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Choose a realistic disaster scenario or type a custom request
              </span>
            </div>

            {/* One-Click Scenarios */}
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DEMO_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  disabled={isRunning}
                  data-testid={`scenario-${sc.id}`}
                  onClick={() => handleRun(sc.prompt)}
                  className="group rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-left transition hover:border-emerald-500/50 hover:bg-slate-900 disabled:opacity-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                      {sc.badge}
                    </span>
                    <Play className="h-3.5 w-3.5 text-slate-500 transition group-hover:text-emerald-400" />
                  </div>
                  <div className="mt-1.5 text-xs font-bold text-slate-100">{sc.title}</div>
                </button>
              ))}
            </div>

            {/* Prompt Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRun();
              }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                data-testid="prompt-input"
                placeholder="Describe a community relief need (e.g., wheelchair shelter, insulin clinic, flood route, reserve beds)..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isRunning || !promptInput.trim()}
                data-testid="run-agent-btn"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin" />
                    Coordinating...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Run Agent Network
                  </>
                )}
              </button>
            </form>

            {/* Output Panel */}
            {lastResult && (
              <div
                data-testid="coordinator-result"
                className="mt-4 space-y-3 rounded-xl border border-emerald-500/30 bg-[#081224] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300">
                    <HeartHandshake className="h-4 w-4" />
                    Coordinated Response
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>
                      Engine: <code className="text-cyan-300">{lastResult.usedProvider}</code>
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" /> Schema-Verified
                    </span>
                  </div>
                </div>

                {/* Render clean structured lines */}
                <div className="space-y-1.5 text-xs leading-relaxed text-slate-200">
                  {lastResult.summary.split('\n').map((line, i) => {
                    if (!line.trim()) return <div key={i} className="h-1" />;
                    if (line.startsWith('### ')) {
                      return (
                        <h3 key={i} className="text-sm font-bold text-white">
                          {line.replace('### ', '')}
                        </h3>
                      );
                    }
                    if (line.startsWith('#### ')) {
                      return (
                        <h4 key={i} className="pt-1 text-xs font-bold tracking-wide text-amber-300 uppercase">
                          {line.replace('#### ', '')}
                        </h4>
                      );
                    }
                    return (
                      <p key={i} className="text-slate-200">
                        {line.replace(/^- /, '• ').replace(/\*\*/g, '')}
                      </p>
                    );
                  })}
                </div>

                {/* Live Federated Peer Highlights */}
                {(lastResult.observations.clinic || lastResult.observations.transit) && (
                  <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
                    {lastResult.observations.clinic?.clinics?.[0] && (
                      <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs">
                        <div className="text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
                          Federated Peer #1 · Metro Clinic Network
                        </div>
                        <div className="mt-1 font-bold text-white">
                          {lastResult.observations.clinic.clinics[0].name}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-300">
                          {lastResult.observations.clinic.medical_need} stock:{' '}
                          <span className="font-bold text-emerald-300">
                            {lastResult.observations.clinic.clinics[0].stock_for_need} units
                          </span>{' '}
                          · Wait ~{lastResult.observations.clinic.clinics[0].wait_minutes}m
                        </div>
                      </div>
                    )}
                    {lastResult.observations.transit?.route && (
                      <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-3 text-xs">
                        <div className="text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
                          Federated Peer #2 · SafeRoute Transit Feed
                        </div>
                        <div className="mt-1 font-bold text-white">
                          {lastResult.observations.transit.route.recommended_corridor}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-300">
                          ETA{' '}
                          <span className="font-bold text-emerald-300">
                            {lastResult.observations.transit.route.eta_minutes} min
                          </span>{' '}
                          · Avoids:{' '}
                          <span className="text-amber-300">{lastResult.observations.transit.route.avoids}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Panel: Live Protocol Trace & Peer Federation Manager */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBottomTab('trace')}
                  data-testid="tab-trace"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    bottomTab === 'trace'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  Live Protocol Trace ({traces.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBottomTab('peers')}
                  data-testid="tab-peers"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                    bottomTab === 'peers'
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Federated Peers ({peers.length})
                </button>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Zap className="h-3 w-3 text-emerald-400" />
                Public runtime exposed at <code>./runtime/engine.js</code>
              </span>
            </div>

            {bottomTab === 'trace' ? (
              <div
                data-testid="protocol-trace-list"
                className="max-h-72 space-y-1.5 overflow-y-auto custom-scrollbar pr-1 font-mono text-[11px]"
              >
                {traces.map((evt) => {
                  const badgeStyle =
                    evt.status === 'error'
                      ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                      : evt.status === 'pending' || evt.status === 'warn'
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-300'
                      : evt.type === 'PEER_FEDERATED'
                      ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';

                  return (
                    <div
                      key={evt.id}
                      className="rounded-lg border border-slate-800/80 bg-slate-950/75 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${badgeStyle}`}>
                            {evt.type}
                          </span>
                          <span className="text-slate-300">
                            {evt.source}
                            {evt.target ? ` -> ${evt.target}` : ''}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {evt.digest ? `${evt.digest} · ` : ''}
                          {evt.timestamp.slice(11, 19)}
                        </span>
                      </div>
                      <div className="mt-1 font-sans text-xs text-slate-200">{evt.summary}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {peers.map((peer) => (
                    <div
                      key={peer.peerId}
                      className="rounded-xl border border-cyan-500/25 bg-slate-950/80 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-cyan-300">{peer.network.name}</span>
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          {peer.isCustom ? 'Dynamic Peer' : 'Verified Peer'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{peer.network.description}</p>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-1 font-mono text-[10px] text-slate-500">
                        <span>entry: {peer.network.entry_agent}</span>
                        <span className="text-cyan-400">{peer.digest}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Attach External Peer URL */}
                <form
                  onSubmit={handleConnectCustomPeer}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5"
                >
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <PlusCircle className="h-4 w-4 text-cyan-400" />
                    Connect External Peer <code className="text-cyan-300">agent-network.json</code> URL
                  </div>
                  <p className="mb-2.5 text-[11px] text-slate-400">
                    Paste any CORS-enabled Open Agentic Web peer JSON URL (or connect our 3rd-party Volunteer Mutual-Aid Mesh peer) to verify and federate it live in-browser.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={customPeerUrl}
                      onChange={(e) => setCustomPeerUrl(e.target.value)}
                      data-testid="custom-peer-input"
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      data-testid="connect-peer-btn"
                      className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 cursor-pointer"
                    >
                      Verify & Federate Peer
                    </button>
                  </div>
                  {peerConnectMsg && (
                    <div
                      data-testid="peer-connect-status"
                      className={`mt-2 flex items-center gap-1.5 text-xs ${
                        peerConnectMsg.kind === 'ok' ? 'text-emerald-300' : 'text-rose-300'
                      }`}
                    >
                      {peerConnectMsg.kind === 'ok' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {peerConnectMsg.text}
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Modals & Drawers */}
      <ApprovalModal request={pendingApproval} onDecision={handleApprovalDecision} />
      <LLMConfigModal
        open={llmModalOpen}
        onClose={() => setLlmModalOpen(false)}
        config={llmConfig}
        onChange={setLlmConfig}
        providers={LLM_PROVIDER_PRESETS}
      />
      <SpecDrawer
        open={specDrawerOpen}
        onClose={() => setSpecDrawerOpen(false)}
        manifest={manifest}
        hostNetwork={hostNetwork}
        peers={peers}
      />
    </div>
  );
}
