/**
 * CivicMesh Open Agentic Web Runtime — Public Browser Runner & Interop Bridge
 * Exposes a clean window.CivicMeshAgenticWeb API so external agentic websites,
 * browser extensions, or devtools scripts can discover and invoke this site's network.
 */

import { AgenticWebEngine } from './engine.js';
import { LLM_PROVIDER_PRESETS } from './llmClient.js';

export async function bootAgenticWebRunner({
  manifestUrl = './agent-manifest.json',
  siteActions = {},
  onTrace,
  onNodeActive,
  onApprovalRequired,
  stepDelayMs = 260
} = {}) {
  const engine = new AgenticWebEngine({
    onTrace,
    onNodeActive,
    onApprovalRequired,
    stepDelayMs
  });

  for (const [name, handler] of Object.entries(siteActions)) {
    engine.registerSiteAction(name, handler);
  }

  const bootstrap = await engine.loadFromManifest(manifestUrl);

  // Publish standard browser interop surface for external agentic web callers
  if (typeof window !== 'undefined') {
    window.CivicMeshAgenticWeb = {
      specVersion: bootstrap.manifest.spec_version,
      manifestUrl,
      hostDigest: bootstrap.hostDigest,
      getManifest: () => bootstrap.manifest,
      getHostNetwork: () => bootstrap.hostNetwork,
      getPeers: () => Array.from(engine.peers.values()),
      connectPeer: (url) => engine.connectPeer(url, { isCustom: true }),
      run: (request, llmConfig) => engine.runRequest(request, llmConfig),
      testSchemaGuard: () => engine.demonstrateSchemaGuard()
    };
  }

  return { engine, bootstrap, providers: LLM_PROVIDER_PRESETS };
}
