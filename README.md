# CivicMesh — Open Agentic Web for Community Relief Coordination

> **Submission for the Open Agentic Web Challenge (Cognizant AI Lab · MIT Media Lab NANDA · Mozilla Otari · AWS)**
> **100% Client-Side Browser Execution · Declarative `agent-network.json` · Multi-Site Peer Federation · Strict JSON Schema Validation · Mandatory HITL Write Approvals**

---

## Why CivicMesh Exists

During urban emergencies (typhoons, earthquakes, floods, power outages), life-critical information is fragmented across **independent, siloed websites**:
- A municipal **Community Shelter & Aid Portal** (open beds, backup power, wheelchair accessibility, supply kits)
- Independent **Medical Clinics & Pharmacies** (cold-chain insulin stock, oxygen refills, wait times)
- Independent **Civic Transit & Road Hazard Feeds** (flooded bridges, downed power lines, accessible shuttle corridors)
- Local **Volunteer Mutual-Aid Networks** (bilingual interpreters, wheelchair van drivers)

No single platform owns all of these organizations. **CivicMesh** demonstrates how the **Open Agentic Web** turns ordinary static websites into a decentralized, verifiable, human-safe multi-agent network running **100% inside the user's browser**.

---

## Worldwide Agentic Web MVS Conformance

CivicMesh implements the core Minimum Viable Specification (MVS) from [`cognizant-ai-labs/agentic-web`](https://github.com/cognizant-ai-labs/agentic-web):

| MVS Requirement | CivicMesh Implementation | Public File |
| :--- | :--- | :--- |
| **Machine-Readable Manifest** | Declares runtime scripts, host entry agent, capabilities, and federated peers | [`public/agent-manifest.json`](./public/agent-manifest.json) |
| **Declarative Agent Network JSON** | Defines `relief_coordinator`, `shelter_specialist`, `dispatch_planner`, JSON Schema `function.parameters`, `instructions`, `tools`, `site_actions`, and `allowed_peers` | [`public/agent-network.json`](./public/agent-network.json) |
| **Cross-Site Peer Federation** | Dynamically fetches, validates, and SHA-256 hashes independent peer networks + supports attaching any external CORS-enabled `agent-network.json` URL at runtime | [`public/peers/clinic-network/agent-network.json`](./public/peers/clinic-network/agent-network.json)<br>[`public/peers/transit-network/agent-network.json`](./public/peers/transit-network/agent-network.json)<br>[`public/peers/volunteer-network/agent-network.json`](./public/peers/volunteer-network/agent-network.json) |
| **Zero-Dependency Browser Runtime** | Standalone ES modules executing client-side with zero backend server, exposed on `window.CivicMeshAgenticWeb` for external agent interop | `dist/runtime/engine.js`<br>`dist/runtime/runner.js`<br>`dist/runtime/schemaValidator.js`<br>`dist/runtime/llmClient.js` |
| **Strict JSON Schema Validation** | Validates every agent, peer, and site-action payload (`type`, `required`, `enum`, `pattern`, `minimum`/`maximum`, `additionalProperties: false`) before execution | [`src/runtime/schemaValidator.js`](./src/runtime/schemaValidator.js) |
| **Human-in-the-Loop (HITL) Safety** | Pauses all `effect: "write"` site actions (`reserve_shelter_bed`, `create_aid_dispatch`) with an explicit JSON payload approval modal | [`src/components/ApprovalModal.tsx`](./src/components/ApprovalModal.tsx) |
| **BYOK LLM Configuration** | Users supply their own keys (Mozilla Otari, OpenAI-compatible, Google Gemini, Local Ollama) directly from the browser — **$0 host LLM cost** — plus a Zero-Key Demo Mode for instant testing | [`src/runtime/llmClient.js`](./src/runtime/llmClient.js) |

---

## Architecture Overview

```text
Browser (Zero-Server Client Runtime)
├── agent-manifest.json
├── agent-network.json (Host: CivicMesh Relief Hub)
│   ├── relief_coordinator  ──► shelter_specialist ──► site://query_shelters (read)
│   │                       │                      └─► site://check_supply_inventory (read)
│   │                       ├──► peer://metro-clinic-triage/clinic_triage_agent (SHA-256 verified)
│   │                       ├──► peer://saferoute-transit-feed/transit_router_agent (SHA-256 verified)
│   │                       ├──► peer://<any-external-url> (Dynamic live peer discovery)
│   │                       └──► dispatch_planner ──► [Strict JSON Schema Validator]
│   │                                             ──► [HITL Approval Gate]
│   │                                             ──► site://reserve_shelter_bed (write)
│   │                                             ──► site://create_aid_dispatch (write)
└── runtime/engine.js + runtime/runner.js (window.CivicMeshAgenticWeb)
```

---

## Quick Start (Local Development)

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Everything runs immediately with Zero-Key Demo Mode — or click **BYOK LLM** in the top bar to connect Mozilla Otari, OpenAI, Google Gemini, or local Ollama.

### Run Automated Verification Tests

```bash
npm test
```

### Build Static Bundle (Ready for GitHub Pages / Vercel / Netlify)

```bash
npm run build
```

The static `dist/` directory includes `agent-manifest.json`, `agent-network.json`, `peers/*/agent-network.json`, and standalone ES modules under `dist/runtime/*.js`.

---

## External Interoperability (Try It in Browser DevTools)

Any external agentic site or developer can inspect and invoke CivicMesh programmatically via the browser runtime bridge:

```js
// Inspect manifest & SHA-256 verified peers
console.log(window.CivicMeshAgenticWeb.getManifest());
console.log(window.CivicMeshAgenticWeb.getPeers());

// Dynamically federate a third-party peer agent-network.json
await window.CivicMeshAgenticWeb.connectPeer('./peers/volunteer-network/agent-network.json');

// Trigger the built-in strict JSON Schema security probe
await window.CivicMeshAgenticWeb.testSchemaGuard();
```

---

## License

Released under the [MIT License](./LICENSE).
