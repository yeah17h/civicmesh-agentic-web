import type { AgenticWebEngine, ApprovalRequest, PeerRecord, ProviderPreset, TraceEvent } from './runtime';

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
