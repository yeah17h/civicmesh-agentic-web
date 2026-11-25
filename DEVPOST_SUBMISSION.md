# Devpost Submission Copy — CivicMesh (Open Agentic Web Challenge)

> Ready-to-paste submission draft for Devpost. Update the **Live URL**, **GitHub Repo URL**, and **YouTube Demo URL** after uploading!

---

## Project Title
**CivicMesh — Open Agentic Web for Federated Community Relief**

## Tagline (Short Description)
Browser-native, MVS-compliant multi-agent web network federating shelters, clinics, and transit feeds with strict JSON Schema validation and human-in-the-loop write approvals.

---

## Inspiration
When a typhoon, flood, or power outage hits a city, residents and volunteers face a classic fragmented-web problem: shelter bed availability lives on a civic portal, insulin and oxygen stock lives on independent clinic sites, bridge closures live on a transit agency feed, and volunteer drivers coordinate on a mutual-aid site. No single company owns all of these websites—and small civic groups cannot afford to host expensive LLM backends for thousands of residents.

That is precisely why the **Open Agentic Web** matters. We built **CivicMesh** to prove that independent static websites can publish declarative `agent-network.json` files, verify one another client-side via SHA-256 digests, run a shared browser runtime with BYOK LLMs ($0 host cost), and safely coordinate real state changes under strict human-in-the-loop (HITL) governance.

---

## What It Does
CivicMesh is a complete, publicly hostable Open Agentic Website consisting of:
1. **Live Interactive Host Relief Hub**: Displays real-time community shelters (bed counts, wheelchair ADA access, backup power, pet friendliness), supply depots, and an auditable ledger of human-approved reservations and dispatches.
2. **Declarative MVS Specifications**: Publishes `agent-manifest.json` and `agent-network.json` defining `relief_coordinator`, `shelter_specialist`, `dispatch_planner`, local `site_actions` (`read` vs. `write`), and `allowed_peers`.
3. **Live Multi-Site Peer Federation**: Automatically discovers, validates, and computes SHA-256 integrity digests for two independent peer networks (**Metro Clinic & Pharmacy Network** and **SafeRoute Transit & Hazard Network**)—and lets users or judges dynamically attach **any external CORS-enabled `agent-network.json` URL** (including our included 3rd-party **Neighborhood Volunteer Mutual-Aid Mesh** peer) at runtime.
4. **Strict JSON Schema Security Guard**: Every agent call, peer call, and local site action is strictly validated against its JSON Schema before execution. Includes a one-click **Test Schema Guard** button that intentionally fires a malformed/injected write payload and demonstrates client-side rejection before it ever reaches the HITL gate or site state.
5. **Human-in-the-Loop (HITL) Approval Gate**: Every `effect: "write"` action (`reserve_shelter_bed`, `create_aid_dispatch`) pauses execution and shows the exact schema-validated JSON payload so the human user can **Approve & Execute** (live-updating shelter beds and the action ledger) or **Decline** safely.
6. **BYOK LLM Gateway + Zero-Key Demo Mode**: Supports **Mozilla Otari**, **OpenAI-compatible**, **Google Gemini**, and **Local Ollama** keys stored strictly in browser memory, plus a Zero-Key deterministic synthesizer so judges can immediately experience the full federated workflow without needing an API key.

---

## How We Built It
- **Standalone Browser Runtime (`src/runtime/*.js` -> `dist/runtime/*.js`)**: Built as pure, zero-dependency ES modules (`engine.js`, `runner.js`, `schemaValidator.js`, `llmClient.js`) conforming to `cognizant-ai-labs/agentic-web` MVS concepts and exposed globally via `window.CivicMeshAgenticWeb` for cross-site interoperability.
- **Frontend & Real-Time Topology UI**: React 19, TypeScript, Tailwind CSS v4, Lucide icons, and an animated SVG multi-agent topology graph that highlights active agents, peer hops, and HITL gates in real time alongside a live protocol trace console and JSON spec inspector.
- **Verification**: Full automated Vitest suite validating all manifest/network JSON documents, strict schema rejection, SHA-256 digests, HITL approve/decline flows, and live dynamic peer federation.

---

## Challenges We Ran Into
- **Balancing Zero-Cost Static Hosting with Real Interoperability**: Ensuring every peer JSON, runtime ES module, and Vite bundle works cleanly under both root URLs and GitHub Pages subpaths (`base: './'`).
- **Making Safety Tangible, Not Invisible**: Showing strict JSON Schema validation and HITL approvals as interactive, auditable UI primitives (including the one-click Schema Guard probe) rather than hiding them in console logs.

---

## Accomplishments That We're Proud Of
- **100% Static & Reusable**: Any civic organization can adopt `dist/runtime/engine.js` and publish a single `agent-network.json` file with zero server maintenance and zero LLM hosting bill.
- **True Multi-Organization Federation**: Demonstrates real-world value where 3+ independent networks collaborate in one browser session to solve an urgent human problem.

---

## Built With
`TypeScript`, `React`, `Vite`, `Tailwind CSS`, `JavaScript ES Modules`, `JSON Schema`, `Web Crypto SHA-256`, `Mozilla Otari / BYOK LLM APIs`, `Vitest`

---

## Links to Fill Before Submitting
- **Live Website URL**: `<Your GitHub Pages / Vercel URL>`
- **Public GitHub Repo**: `<Your GitHub Repository URL>`
- **Demo Video (< 2 min YouTube URL)**: `<Upload demo/civicmesh-demo.mp4 to YouTube and paste URL here>`
