export interface TraceEvent {
  id: string;
  timestamp: string;
  type:
    | 'NETWORK_LOADED'
    | 'PEER_FEDERATED'
    | 'AGENT_CALL'
    | 'SCHEMA_VALIDATED'
    | 'SCHEMA_REJECTED'
    | 'HITL_REQUIRED'
    | 'HITL_APPROVED'
    | 'HITL_REJECTED'
    | 'ACTION_EXECUTED'
    | 'FINAL_RESPONSE';
  source: string;
  target?: string;
  summary: string;
  digest?: string;
  status: 'ok' | 'pending' | 'warn' | 'error';
  details?: Record<string, unknown>;
}

export interface ApprovalRequest {
  actionName: string;
  callerAgent: string;
  effect: 'read' | 'write';
  description: string;
  args: Record<string, unknown>;
}

export interface LLMConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export interface PeerRecord {
  peerId: string;
  url: string;
  network: {
    network_id: string;
    name: string;
    publisher?: string;
    description: string;
    entry_agent: string;
    agents: Array<{
      name: string;
      role?: string;
      function: { description: string; parameters: Record<string, unknown> };
      instructions: string;
      tools: string[];
    }>;
    public_dataset?: Record<string, unknown>;
  };
  digest: string;
  status: string;
  isCustom: boolean;
}

export interface ProviderPreset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  requiresKey: boolean;
  description: string;
}

export declare const LLM_PROVIDER_PRESETS: Record<string, ProviderPreset>;

export declare function validateJsonSchema(
  schema: Record<string, unknown>,
  value: unknown,
  path?: string
): { valid: boolean; errors: string[] };

export declare function validateNetworkDocument(
  doc: unknown
): { valid: boolean; errors: string[] };

export declare function computeDigest(payload: unknown): Promise<string>;

export declare class AgenticWebEngine {
  manifest: Record<string, unknown> | null;
  hostNetwork: Record<string, unknown> | null;
  hostDigest: string | null;
  peers: Map<string, PeerRecord>;
  constructor(options?: {
    onTrace?: (event: TraceEvent) => void;
    onNodeActive?: (nodeId: string | null) => void;
    onApprovalRequired?: (req: ApprovalRequest) => Promise<boolean>;
    fetcher?: (url: string) => Promise<Response>;
    stepDelayMs?: number;
  });
  registerSiteAction(name: string, handler: (args: any) => Promise<any> | any): void;
  loadFromManifest(manifestUrl?: string): Promise<{
    manifest: any;
    hostNetwork: any;
    hostDigest: string;
    peers: PeerRecord[];
  }>;
  connectPeer(peerUrl: string, opts?: { peerId?: string; isCustom?: boolean }): Promise<PeerRecord>;
  invokeSiteAction(actionName: string, args: Record<string, unknown>, callerAgent: string): Promise<any>;
  runRequest(userRequest: string, llmConfig?: LLMConfig): Promise<{
    summary: string;
    usedProvider: string;
    model: string;
    observations: Record<string, any>;
    actionOutcomes: Array<{ status: string; action: string; message: string; data?: any }>;
  }>;
  demonstrateSchemaGuard(): Promise<{
    status: string;
    action: string;
    errors: string[];
    message: string;
  }>;
}

export declare function bootAgenticWebRunner(options?: {
  manifestUrl?: string;
  siteActions?: Record<string, (args: any) => Promise<any> | any>;
  onTrace?: (event: TraceEvent) => void;
  onNodeActive?: (nodeId: string | null) => void;
  onApprovalRequired?: (req: ApprovalRequest) => Promise<boolean>;
  stepDelayMs?: number;
}): Promise<{
  engine: AgenticWebEngine;
  bootstrap: {
    manifest: any;
    hostNetwork: any;
    hostDigest: string;
    peers: PeerRecord[];
  };
  providers: Record<string, ProviderPreset>;
}>;
