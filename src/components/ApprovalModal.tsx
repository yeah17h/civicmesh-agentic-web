import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle, FileCheck2 } from 'lucide-react';
import type { ApprovalRequest } from '../runtime/runtime';

interface ApprovalModalProps {
  request: ApprovalRequest | null;
  onDecision: (approved: boolean) => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({ request, onDecision }) => {
  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hitl-modal-title"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-amber-500/50 bg-slate-900 shadow-2xl shadow-amber-950/40">
        <div className="flex items-start gap-3 border-b border-slate-800 bg-amber-500/10 px-5 py-4">
          <div className="mt-0.5 rounded-lg bg-amber-500/20 p-2 text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold tracking-wider text-amber-300 uppercase">
                HITL Approval Required
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                <FileCheck2 className="h-3 w-3" /> JSON Schema Verified
              </span>
            </div>
            <h3 id="hitl-modal-title" className="mt-1.5 text-base font-bold text-slate-100">
              Approve state-changing action: <code className="text-amber-300">{request.actionName}</code>
            </h3>
            <p className="mt-0.5 text-xs text-slate-300">{request.description}</p>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Requested by agent: <code className="text-slate-200">{request.callerAgent}</code>
            </span>
            <span>
              Effect: <code className="font-semibold text-amber-300 uppercase">{request.effect}</code>
            </span>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-300">
              Schema-Validated Payload (will mutate live host site state):
            </div>
            <pre className="max-h-56 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-emerald-300">
              {JSON.stringify(request.args, null, 2)}
            </pre>
          </div>

          <p className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-[11px] text-slate-400">
            Per the Worldwide Agentic Web MVS, write actions never execute silently. Review the exact validated JSON arguments above before approving.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-900/90 px-5 py-3.5">
          <button
            type="button"
            onClick={() => onDecision(false)}
            data-testid="hitl-reject-btn"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 cursor-pointer"
          >
            <XCircle className="h-4 w-4 text-rose-400" />
            Decline Action
          </button>
          <button
            type="button"
            onClick={() => onDecision(true)}
            data-testid="hitl-approve-btn"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve & Execute Write
          </button>
        </div>
      </div>
    </div>
  );
};
