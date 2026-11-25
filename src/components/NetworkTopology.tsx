import React from 'react';
import type { PeerRecord } from '../runtime/runtime';

interface NetworkTopologyProps {
  activeNode: string | null;
  hostDigest: string | null;
  peers: PeerRecord[];
}

export const NetworkTopology: React.FC<NetworkTopologyProps> = ({ activeNode, hostDigest, peers }) => {
  const isActive = (id: string) => activeNode === id;

  const customPeer = peers.find((p) => p.isCustom);
  const clinicPeer = peers.find((p) => p.peerId === 'metro-clinic-triage');
  const transitPeer = peers.find((p) => p.peerId === 'saferoute-transit-feed');

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">
            Live Federated Agent Topology
          </h2>
          <p className="text-xs text-slate-400">
            Host network + cross-site <code className="text-cyan-300">allowed_peers</code> + HITL write gate executing in-browser
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Host Agents
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-cyan-400" /> Federated Peers
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> HITL Write Gate
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border border-slate-800/80 bg-[#060b16] p-2">
        <svg viewBox="0 0 760 225" className="h-auto w-full" role="img" aria-label="Agent network topology diagram">
          <defs>
            <linearGradient id="edgeHost" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="edgePeer" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
            </linearGradient>
          </defs>

          {/* Subtle grid dots */}
          <rect x="0" y="0" width="760" height="225" fill="transparent" />

          {/* Edges from relief_coordinator (x=175, y=112) */}
          {/* To shelter_specialist */}
          <path
            d="M 245 96 C 285 96, 295 45, 340 45"
            fill="none"
            stroke={isActive('shelter_specialist') ? '#34d399' : '#1e293b'}
            strokeWidth={isActive('shelter_specialist') ? 3 : 2}
            strokeDasharray={isActive('shelter_specialist') ? '6 4' : undefined}
          />
          {/* To dispatch_planner */}
          <path
            d="M 245 128 C 285 128, 295 178, 340 178"
            fill="none"
            stroke={isActive('dispatch_planner') || isActive('hitl_gate') ? '#f59e0b' : '#1e293b'}
            strokeWidth={isActive('dispatch_planner') || isActive('hitl_gate') ? 3 : 2}
            strokeDasharray={isActive('dispatch_planner') || isActive('hitl_gate') ? '6 4' : undefined}
          />
          {/* To HITL Gate */}
          <path
            d="M 515 178 L 570 178"
            fill="none"
            stroke={isActive('hitl_gate') ? '#f59e0b' : '#334155'}
            strokeWidth={isActive('hitl_gate') ? 3 : 2}
            strokeDasharray="4 3"
          />
          {/* To Clinic Peer */}
          <path
            d="M 245 106 C 390 106, 460 45, 570 45"
            fill="none"
            stroke={isActive('metro-clinic-triage') ? '#22d3ee' : '#1e293b'}
            strokeWidth={isActive('metro-clinic-triage') ? 3 : 2}
            strokeDasharray={isActive('metro-clinic-triage') ? '6 4' : '4 4'}
          />
          {/* To Transit Peer */}
          <path
            d="M 245 116 C 390 116, 460 112, 570 112"
            fill="none"
            stroke={isActive('saferoute-transit-feed') ? '#22d3ee' : '#1e293b'}
            strokeWidth={isActive('saferoute-transit-feed') ? 3 : 2}
            strokeDasharray={isActive('saferoute-transit-feed') ? '6 4' : '4 4'}
          />

          {/* Host Boundary Box */}
          <rect
            x="16"
            y="10"
            width="514"
            height="205"
            rx="12"
            fill="rgba(16, 185, 129, 0.03)"
            stroke="rgba(16, 185, 129, 0.2)"
            strokeDasharray="4 4"
          />
          <text x="28" y="28" fill="#6ee7b7" fontSize="10" fontWeight="600">
            HOST SITE · agent-network.json ({hostDigest || 'loading...'})
          </text>

          {/* Node 1: relief_coordinator */}
          <g transform="translate(32, 74)">
            {isActive('relief_coordinator') && (
              <rect
                x="-4"
                y="-4"
                width="220"
                height="84"
                rx="13"
                fill="none"
                stroke="#34d399"
                strokeWidth="2"
                className="animate-node-pulse"
              />
            )}
            <rect
              width="212"
              height="76"
              rx="10"
              fill={isActive('relief_coordinator') ? '#064e3b' : '#0f172a'}
              stroke={isActive('relief_coordinator') ? '#34d399' : '#334155'}
              strokeWidth="1.5"
            />
            <text x="14" y="24" fill="#34d399" fontSize="10" fontWeight="700">
              ENTRY ORCHESTRATOR
            </text>
            <text x="14" y="43" fill="#f8fafc" fontSize="13" fontWeight="700">
              relief_coordinator
            </text>
            <text x="14" y="61" fill="#94a3b8" fontSize="10">
              Routes local + peer tools
            </text>
          </g>

          {/* Node 2: shelter_specialist */}
          <g transform="translate(340, 18)">
            {isActive('shelter_specialist') && (
              <rect
                x="-4"
                y="-4"
                width="182"
                height="62"
                rx="12"
                fill="none"
                stroke="#34d399"
                strokeWidth="2"
                className="animate-node-pulse"
              />
            )}
            <rect
              width="174"
              height="54"
              rx="9"
              fill={isActive('shelter_specialist') ? '#064e3b' : '#0f172a'}
              stroke={isActive('shelter_specialist') ? '#34d399' : '#334155'}
              strokeWidth="1.5"
            />
            <text x="12" y="20" fill="#6ee7b7" fontSize="9.5" fontWeight="700">
              READ SITE ACTIONS
            </text>
            <text x="12" y="38" fill="#f8fafc" fontSize="12" fontWeight="600">
              shelter_specialist
            </text>
          </g>

          {/* Node 3: dispatch_planner */}
          <g transform="translate(340, 150)">
            {isActive('dispatch_planner') && (
              <rect
                x="-4"
                y="-4"
                width="182"
                height="62"
                rx="12"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="2"
                className="animate-node-pulse"
              />
            )}
            <rect
              width="174"
              height="54"
              rx="9"
              fill={isActive('dispatch_planner') ? '#451a03' : '#0f172a'}
              stroke={isActive('dispatch_planner') ? '#fbbf24' : '#334155'}
              strokeWidth="1.5"
            />
            <text x="12" y="20" fill="#fcd34d" fontSize="9.5" fontWeight="700">
              WRITE ACTION PLANNER
            </text>
            <text x="12" y="38" fill="#f8fafc" fontSize="12" fontWeight="600">
              dispatch_planner
            </text>
          </g>

          {/* Node 4: Peer Clinic */}
          <g transform="translate(570, 16)">
            {isActive('metro-clinic-triage') && (
              <rect
                x="-4"
                y="-4"
                width="182"
                height="64"
                rx="12"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                className="animate-node-pulse"
              />
            )}
            <rect
              width="174"
              height="56"
              rx="9"
              fill={isActive('metro-clinic-triage') ? '#083344' : '#0b1628'}
              stroke={isActive('metro-clinic-triage') ? '#22d3ee' : '#155e75'}
              strokeWidth="1.5"
            />
            <text x="12" y="18" fill="#22d3ee" fontSize="9.5" fontWeight="700">
              PEER #1 · CLINIC NETWORK
            </text>
            <text x="12" y="34" fill="#f8fafc" fontSize="11.5" fontWeight="600">
              clinic_triage_agent
            </text>
            <text x="12" y="48" fill="#67e8f9" fontSize="9">
              {clinicPeer?.digest || 'verifying...'}
            </text>
          </g>

          {/* Node 5: Peer Transit */}
          <g transform="translate(570, 84)">
            {isActive('saferoute-transit-feed') && (
              <rect
                x="-4"
                y="-4"
                width="182"
                height="64"
                rx="12"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2"
                className="animate-node-pulse"
              />
            )}
            <rect
              width="174"
              height="56"
              rx="9"
              fill={isActive('saferoute-transit-feed') ? '#083344' : '#0b1628'}
              stroke={isActive('saferoute-transit-feed') ? '#22d3ee' : '#155e75'}
              strokeWidth="1.5"
            />
            <text x="12" y="18" fill="#22d3ee" fontSize="9.5" fontWeight="700">
              PEER #2 · TRANSIT FEED
            </text>
            <text x="12" y="34" fill="#f8fafc" fontSize="11.5" fontWeight="600">
              transit_router_agent
            </text>
            <text x="12" y="48" fill="#67e8f9" fontSize="9">
              {transitPeer?.digest || 'verifying...'}
            </text>
          </g>

          {/* Node 6: HITL Approval Gate */}
          <g transform="translate(570, 150)">
            {isActive('hitl_gate') && (
              <rect
                x="-4"
                y="-4"
                width="182"
                height="64"
                rx="12"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2"
                className="animate-node-pulse"
              />
            )}
            <rect
              width="174"
              height="56"
              rx="9"
              fill={isActive('hitl_gate') ? '#451a03' : '#1c1917'}
              stroke={isActive('hitl_gate') ? '#fbbf24' : '#92400e'}
              strokeWidth="1.5"
            />
            <text x="12" y="18" fill="#fbbf24" fontSize="9.5" fontWeight="700">
              HUMAN-IN-THE-LOOP GATE
            </text>
            <text x="12" y="35" fill="#fef3c7" fontSize="11.5" fontWeight="600">
              Write Action Approval
            </text>
            <text x="12" y="49" fill="#fcd34d" fontSize="9">
              {customPeer ? `+ Custom Peer: ${customPeer.peerId}` : 'Schema-verified payloads only'}
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
};
