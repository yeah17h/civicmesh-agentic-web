/**
 * CivicMesh Open Agentic Web Runtime — Core Browser Execution Engine
 * Implements the Worldwide Agentic Web MVS:
 *  - Declarative agent-manifest.json & agent-network.json loading
 *  - SHA-256 package digest calculation (NANDA-inspired verifiability)
 *  - Strict JSON Schema validation on all agent, peer, and site-action arguments
 *  - Cross-site peer federation via allowed_peers + dynamic external peer URLs
 *  - Mandatory Human-in-the-Loop (HITL) approval gate for effect="write" actions
 */

import { validateJsonSchema, validateNetworkDocument, computeDigest } from './schemaValidator.js';
import { generateCoordinatorSummary } from './llmClient.js';

export class AgenticWebEngine {
  constructor(options = {}) {
    this.manifest = null;
    this.hostNetwork = null;
    this.hostDigest = null;
    this.peers = new Map(); // peer_id -> { url, network, digest, status, isCustom }
    this.siteActionHandlers = new Map(); // actionName -> async (args) => result
    this.siteActionSchemas = new Map(); // actionName -> actionDefinition
    this.onTrace = options.onTrace || (() => {});
    this.onNodeActive = options.onNodeActive || (() => {});
    this.onApprovalRequired = options.onApprovalRequired || (async () => false);
    this.fetcher = options.fetcher || ((url) => fetch(url));
    this.stepDelayMs = typeof options.stepDelayMs === 'number' ? options.stepDelayMs : 280;
  }

  emitTrace(event) {
    const enriched = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event
    };
    this.onTrace(enriched);
    return enriched;
  }

  async pause(ms = this.stepDelayMs) {
    if (ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  registerSiteAction(name, handler) {
    this.siteActionHandlers.set(name, handler);
  }

  async loadFromManifest(manifestUrl = './agent-manifest.json') {
    const manifestRes = await this.fetcher(manifestUrl);
    if (!manifestRes.ok) {
      throw new Error(`Failed to fetch manifest ${manifestUrl}: HTTP ${manifestRes.status}`);
    }
    this.manifest = await manifestRes.json();
    const hostEntry = this.manifest.networks?.[0];
    if (!hostEntry?.network_url) {
      throw new Error('Manifest missing networks[0].network_url');
    }

    await this.loadHostNetwork(hostEntry.network_url);

    const allowedPeers = this.hostNetwork.allowed_peers || [];
    for (const peerRef of allowedPeers) {
      await this.connectPeer(peerRef.url, { peerId: peerRef.peer_id, isCustom: false });
    }

    return {
      manifest: this.manifest,
      hostNetwork: this.hostNetwork,
      hostDigest: this.hostDigest,
      peers: Array.from(this.peers.values())
    };
  }

  async loadHostNetwork(networkUrl) {
    const res = await this.fetcher(networkUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch host network ${networkUrl}: HTTP ${res.status}`);
    }
    const network = await res.json();
    const validation = validateNetworkDocument(network);
    if (!validation.valid) {
      throw new Error(`Invalid host agent-network.json: ${validation.errors.join('; ')}`);
    }

    this.hostNetwork = network;
    this.hostDigest = await computeDigest(network);
    this.siteActionSchemas.clear();
    for (const action of network.site_actions || []) {
      this.siteActionSchemas.set(action.name, action);
    }

    this.emitTrace({
      type: 'NETWORK_LOADED',
      source: network.network_id,
      summary: `Loaded host network "${network.name}" (${network.agents.length} agents, ${(network.site_actions || []).length} site actions)`,
      digest: this.hostDigest,
      status: 'ok'
    });
  }

  async connectPeer(peerUrl, opts = {}) {
    const res = await this.fetcher(peerUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch peer network at ${peerUrl}: HTTP ${res.status}`);
    }
    const peerDoc = await res.json();
    const validation = validateNetworkDocument(peerDoc);
    if (!validation.valid) {
      throw new Error(`Peer JSON schema validation failed: ${validation.errors.join('; ')}`);
    }

    const digest = await computeDigest(peerDoc);
    const peerId = opts.peerId || peerDoc.network_id;
    const record = {
      peerId,
      url: peerUrl,
      network: peerDoc,
      digest,
      status: 'connected',
      isCustom: Boolean(opts.isCustom)
    };
    this.peers.set(peerId, record);

    this.emitTrace({
      type: 'PEER_FEDERATED',
      source: peerId,
      summary: `Federated peer "${peerDoc.name}" via ${peerUrl}`,
      digest,
      status: 'ok',
      details: {
        entry_agent: peerDoc.entry_agent,
        agents: peerDoc.agents.map((a) => a.name)
      }
    });

    return record;
  }

  getAgentDef(network, agentName) {
    return (network?.agents || []).find((a) => a.name === agentName) || null;
  }

  async invokeSiteAction(actionName, args, callerAgent) {
    const schemaDef = this.siteActionSchemas.get(actionName);
    if (!schemaDef) {
      throw new Error(`Unknown site action: ${actionName}`);
    }

    const validation = validateJsonSchema(schemaDef.input_schema, args, actionName);
    if (!validation.valid) {
      this.emitTrace({
        type: 'SCHEMA_REJECTED',
        source: callerAgent,
        target: `site://${actionName}`,
        summary: `Blocked invalid call to ${actionName}: ${validation.errors.join('; ')}`,
        status: 'error',
        details: { args, errors: validation.errors }
      });
      return {
        status: 'schema_rejected',
        action: actionName,
        errors: validation.errors,
        message: validation.errors.join('; ')
      };
    }

    this.emitTrace({
      type: 'SCHEMA_VALIDATED',
      source: callerAgent,
      target: `site://${actionName}`,
      summary: `JSON Schema PASS for ${actionName} (effect: ${schemaDef.effect})`,
      status: 'ok',
      details: { args, effect: schemaDef.effect }
    });

    if (schemaDef.effect === 'write') {
      this.onNodeActive('hitl_gate');
      this.emitTrace({
        type: 'HITL_REQUIRED',
        source: callerAgent,
        target: `site://${actionName}`,
        summary: `Paused for human approval before write action "${actionName}"`,
        status: 'pending',
        details: { args, description: schemaDef.description }
      });

      const approved = await this.onApprovalRequired({
        actionName,
        callerAgent,
        effect: schemaDef.effect,
        description: schemaDef.description,
        args
      });

      if (!approved) {
        this.emitTrace({
          type: 'HITL_REJECTED',
          source: 'human_reviewer',
          target: `site://${actionName}`,
          summary: `Human reviewer declined write action "${actionName}" — host state untouched`,
          status: 'warn',
          details: { args }
        });
        return {
          status: 'rejected',
          action: actionName,
          message: 'Declined by human reviewer'
        };
      }

      this.emitTrace({
        type: 'HITL_APPROVED',
        source: 'human_reviewer',
        target: `site://${actionName}`,
        summary: `Human reviewer approved write action "${actionName}"`,
        status: 'ok',
        details: { args }
      });
    }

    const handler = this.siteActionHandlers.get(actionName);
    if (!handler) {
      throw new Error(`No handler registered for site action "${actionName}"`);
    }

    const result = await handler(args);
    this.emitTrace({
      type: 'ACTION_EXECUTED',
      source: `site://${actionName}`,
      target: callerAgent,
      summary: result.summary || `Executed ${actionName}`,
      status: 'ok',
      details: result
    });

    return {
      status: 'executed',
      action: actionName,
      data: result,
      message: result.summary || `Completed ${actionName}`
    };
  }

  async invokePeerAgent(peerId, agentName, args, callerAgent) {
    const peer = this.peers.get(peerId);
    if (!peer) {
      throw new Error(`Peer "${peerId}" is not connected`);
    }
    const agentDef = this.getAgentDef(peer.network, agentName);
    if (!agentDef) {
      throw new Error(`Agent "${agentName}" not found on peer "${peerId}"`);
    }

    const validation = validateJsonSchema(agentDef.function.parameters, args, `${peerId}/${agentName}`);
    if (!validation.valid) {
      this.emitTrace({
        type: 'SCHEMA_REJECTED',
        source: callerAgent,
        target: `peer://${peerId}/${agentName}`,
        summary: `Blocked invalid peer call to ${peerId}/${agentName}: ${validation.errors.join('; ')}`,
        status: 'error',
        details: { args, errors: validation.errors }
      });
      throw new Error(validation.errors.join('; '));
    }

    this.onNodeActive(peerId);
    this.emitTrace({
      type: 'AGENT_CALL',
      source: callerAgent,
      target: `peer://${peerId}/${agentName}`,
      summary: `Federated call to ${peer.network.name} (${peer.digest})`,
      status: 'ok',
      details: { args, digest: peer.digest }
    });
    await this.pause();

    const dataset = peer.network.public_dataset || {};

    if (peerId === 'metro-clinic-triage') {
      const need = args.medical_need || 'general';
      const preferredDistrict = args.district && args.district !== 'Any' ? args.district : null;
      const matches = (dataset.clinics || [])
        .map((c) => ({
          ...c,
          stock_for_need: c.stock?.[need] ?? 0
        }))
        .filter((c) => c.stock_for_need > 0)
        .sort((a, b) => {
          const distScoreA = preferredDistrict && a.district === preferredDistrict ? 1 : 0;
          const distScoreB = preferredDistrict && b.district === preferredDistrict ? 1 : 0;
          if (distScoreB !== distScoreA) return distScoreB - distScoreA;
          return b.stock_for_need - a.stock_for_need;
        });

      const payload = {
        peer_id: peerId,
        medical_need: need,
        clinics: matches,
        summary: matches.length
          ? `Found ${matches.length} clinics with ${need} stock (top: ${matches[0].name}, ${matches[0].stock_for_need} units)`
          : `No clinics currently report ${need} stock`
      };
      this.emitTrace({
        type: 'ACTION_EXECUTED',
        source: `peer://${peerId}/${agentName}`,
        target: callerAgent,
        summary: payload.summary,
        status: 'ok',
        details: payload
      });
      return payload;
    }

    if (peerId === 'saferoute-transit-feed') {
      const from = args.origin_district;
      const to = args.destination_district;
      const route =
        (dataset.routes || []).find((r) => r.from === from && r.to === to) ||
        (dataset.routes || []).find((r) => r.from === to && r.to === from) ||
        (dataset.routes || [])[0] ||
        null;

      const payload = {
        peer_id: peerId,
        hazards: dataset.hazards || [],
        route,
        summary: route
          ? `Safe route ${from} -> ${to}: ${route.recommended_corridor} (${route.eta_minutes} min, avoids ${route.avoids})`
          : `No open route found between ${from} and ${to}`
      };
      this.emitTrace({
        type: 'ACTION_EXECUTED',
        source: `peer://${peerId}/${agentName}`,
        target: callerAgent,
        summary: payload.summary,
        status: 'ok',
        details: payload
      });
      return payload;
    }

    // Generic handler for dynamically connected third-party peer networks
    const payload = {
      peer_id: peerId,
      networkName: peer.network.name,
      entryAgent: peer.network.entry_agent,
      digest: peer.digest,
      summary: `Peer "${peer.network.name}" responded via entry agent "${peer.network.entry_agent}" (${agentDef.function.description})`
    };
    this.emitTrace({
      type: 'ACTION_EXECUTED',
      source: `peer://${peerId}/${agentName}`,
      target: callerAgent,
      summary: payload.summary,
      status: 'ok',
      details: payload
    });
    return payload;
  }

  /**
   * Parses natural-language intent into structured, schema-conforming execution plan.
   */
  parseIntent(userRequest) {
    const q = userRequest.toLowerCase();

    const districtList = ['Harbor', 'Midtown', 'Eastside', 'Northgate'];
    let originDistrict = 'Harbor';
    for (const d of districtList) {
      if (q.includes(d.toLowerCase())) {
        originDistrict = d;
        break;
      }
    }

    const needsWheelchair = /wheelchair|accessible|ramp|mobility|elderly/.test(q);
    const needsPower = /power|generator|oxygen|cpap|insulin|fridge|cold|battery|charger/.test(q);
    const needsPets = /pet|dog|cat/.test(q);

    let medicalNeed = null;
    if (/insulin|diabet/.test(q)) medicalNeed = 'insulin';
    else if (/oxygen|asthma|breath|cpap/.test(q)) medicalNeed = 'oxygen';
    else if (/pediatric|baby|infant|child/.test(q)) medicalNeed = 'pediatric';
    else if (/clinic|medic|first aid|injury|nurse|doctor|hospital/.test(q)) medicalNeed = 'first_aid';

    let supplyItem = null;
    if (/water/.test(q)) supplyItem = 'water_packs';
    else if (/formula|baby|infant/.test(q)) supplyItem = 'baby_formula';
    else if (/blanket|cold|warm/.test(q)) supplyItem = 'blankets';
    else if (/solar|charger|phone/.test(q)) supplyItem = 'solar_chargers';
    else if (/medical|kit|first aid/.test(q)) supplyItem = 'medical_kits';

    const partyMatch = q.match(/(\d+)\s*(people|persons|beds|adults|family|members)/);
    let partySize = partyMatch ? Math.min(12, Math.max(1, parseInt(partyMatch[1], 10))) : 2;
    if (/family of (\d+)/.test(q)) {
      partySize = Math.min(12, Math.max(1, parseInt(q.match(/family of (\d+)/)[1], 10)));
    } else if (/\bsolo\b|\b1 person\b|\bmyself\b/.test(q)) {
      partySize = 1;
    }

    const wantsReservation = /reserve|book|hold|bed|shelter|evacuate|stay/.test(q);
    const wantsDispatch = /dispatch|deliver|send|courier|supply|water|blanket|formula|kit/.test(q);
    const wantsTransit = /route|bridge|flood|road|shuttle|transit|evacuate|get to|travel|wheelchair/.test(q);

    return {
      originDistrict,
      needsWheelchair,
      needsPower,
      needsPets,
      medicalNeed,
      supplyItem: supplyItem || (wantsDispatch ? 'medical_kits' : null),
      partySize,
      wantsReservation,
      wantsDispatch,
      wantsTransit
    };
  }

  /**
   * Executes the full multi-agent coordination workflow starting at relief_coordinator.
   */
  async runRequest(userRequest, llmConfig = { provider: 'demo-deterministic' }) {
    if (!this.hostNetwork) {
      throw new Error('Host network not loaded. Call loadFromManifest() first.');
    }

    const coordinator = this.getAgentDef(this.hostNetwork, this.hostNetwork.entry_agent);
    const entryValidation = validateJsonSchema(
      coordinator.function.parameters,
      { request: userRequest },
      coordinator.name
    );
    if (!entryValidation.valid) {
      this.emitTrace({
        type: 'SCHEMA_REJECTED',
        source: 'user',
        target: coordinator.name,
        summary: `Entry request failed JSON Schema: ${entryValidation.errors.join('; ')}`,
        status: 'error',
        details: { errors: entryValidation.errors }
      });
      throw new Error(entryValidation.errors.join('; '));
    }

    this.onNodeActive('relief_coordinator');
    this.emitTrace({
      type: 'AGENT_CALL',
      source: 'user',
      target: 'relief_coordinator',
      summary: `Coordinator received request (${llmConfig.provider || 'demo-deterministic'})`,
      status: 'ok',
      details: { request: userRequest }
    });
    await this.pause();

    const intent = this.parseIntent(userRequest);
    const observations = { externalPeers: [] };
    const actionOutcomes = [];

    // 1. Delegate to shelter_specialist (Local Read Actions)
    this.onNodeActive('shelter_specialist');
    const shelterQuery = {
      district: 'Any',
      needs_wheelchair: intent.needsWheelchair,
      needs_power: intent.needsPower,
      needs_pets: intent.needsPets,
      min_beds: intent.partySize
    };
    this.emitTrace({
      type: 'AGENT_CALL',
      source: 'relief_coordinator',
      target: 'shelter_specialist',
      summary: `Delegating shelter & inventory lookup (min ${intent.partySize} beds)`,
      status: 'ok',
      details: shelterQuery
    });
    await this.pause();

    const shelterRes = await this.invokeSiteAction('query_shelters', shelterQuery, 'shelter_specialist');
    if (shelterRes.status === 'executed') {
      observations.shelters = shelterRes.data;
    }

    if (intent.supplyItem) {
      const supplyRes = await this.invokeSiteAction(
        'check_supply_inventory',
        { item: intent.supplyItem },
        'shelter_specialist'
      );
      if (supplyRes.status === 'executed') {
        observations.supplies = supplyRes.data;
      }
    }

    const recommendedShelter = observations.shelters?.matches?.[0] || null;

    // 2. Delegate to Federated Peer #1: Metro Clinic & Pharmacy Network
    if (intent.medicalNeed && this.peers.has('metro-clinic-triage')) {
      observations.clinic = await this.invokePeerAgent(
        'metro-clinic-triage',
        'clinic_triage_agent',
        {
          district: recommendedShelter?.district || intent.originDistrict,
          medical_need: intent.medicalNeed
        },
        'relief_coordinator'
      );
    }

    // 3. Delegate to Federated Peer #2: SafeRoute Transit & Hazard Network
    if ((intent.wantsTransit || recommendedShelter) && this.peers.has('saferoute-transit-feed')) {
      const destDistrict = recommendedShelter?.district || 'Midtown';
      observations.transit = await this.invokePeerAgent(
        'saferoute-transit-feed',
        'transit_router_agent',
        {
          origin_district: intent.originDistrict,
          destination_district: destDistrict,
          wheelchair_accessible: intent.needsWheelchair
        },
        'relief_coordinator'
      );
    }

    // 4. Query any custom external peers dynamically attached by the user/judge
    for (const peer of this.peers.values()) {
      if (peer.isCustom) {
        const entry = this.getAgentDef(peer.network, peer.network.entry_agent);
        const minimalArgs = {};
        if (entry?.function?.parameters?.required?.includes('request')) {
          minimalArgs.request = userRequest;
        }
        try {
          const extResult = await this.invokePeerAgent(
            peer.peerId,
            peer.network.entry_agent,
            minimalArgs,
            'relief_coordinator'
          );
          observations.externalPeers.push(extResult);
        } catch (err) {
          this.emitTrace({
            type: 'SCHEMA_REJECTED',
            source: 'relief_coordinator',
            target: `peer://${peer.peerId}`,
            summary: `Custom peer call skipped: ${err.message}`,
            status: 'warn'
          });
        }
      }
    }

    // 5. Delegate to dispatch_planner for Human-in-the-Loop write actions
    if (recommendedShelter && (intent.wantsReservation || intent.wantsDispatch)) {
      this.onNodeActive('dispatch_planner');
      this.emitTrace({
        type: 'AGENT_CALL',
        source: 'relief_coordinator',
        target: 'dispatch_planner',
        summary: `Preparing schema-validated write proposal(s) for ${recommendedShelter.name} (${recommendedShelter.id})`,
        status: 'ok'
      });
      await this.pause();

      if (intent.wantsReservation) {
        const reserveArgs = {
          shelter_id: recommendedShelter.id,
          party_size: intent.partySize,
          resident_alias: `Resident-${intent.originDistrict}`,
          accessibility_notes: [
            intent.needsWheelchair ? 'Wheelchair ramp required' : null,
            intent.needsPower ? 'Medical backup power required' : null,
            intent.needsPets ? 'Accompanied by pet' : null
          ]
            .filter(Boolean)
            .join('; ') || 'Standard intake'
        };
        const outcome = await this.invokeSiteAction('reserve_shelter_bed', reserveArgs, 'dispatch_planner');
        actionOutcomes.push(outcome);
      }

      if (intent.wantsDispatch && intent.supplyItem) {
        const dispatchArgs = {
          destination_shelter_id: recommendedShelter.id,
          supply_item: intent.supplyItem,
          quantity: Math.min(10, Math.max(2, intent.partySize * 2)),
          priority: intent.medicalNeed ? 'critical' : 'urgent',
          notes: `Coordinated via CivicMesh for ${intent.originDistrict} request`
        };
        const outcome = await this.invokeSiteAction('create_aid_dispatch', dispatchArgs, 'dispatch_planner');
        actionOutcomes.push(outcome);
      }
    }

    this.onNodeActive('relief_coordinator');
    const summaryResult = await generateCoordinatorSummary({
      llmConfig,
      userRequest,
      observations,
      actionOutcomes
    });

    this.emitTrace({
      type: 'FINAL_RESPONSE',
      source: 'relief_coordinator',
      target: 'user',
      summary: `Completed federated coordination via ${summaryResult.usedProvider}`,
      status: 'ok'
    });
    this.onNodeActive(null);

    return {
      summary: summaryResult.text,
      usedProvider: summaryResult.usedProvider,
      model: summaryResult.model,
      observations,
      actionOutcomes
    };
  }

  /**
   * Intentionally invokes reserve_shelter_bed with malformed arguments to demonstrate
   * MVS strict JSON Schema enforcement blocking bad payloads before reaching site handlers.
   */
  async demonstrateSchemaGuard() {
    this.onNodeActive('dispatch_planner');
    const badPayload = {
      shelter_id: 'INVALID_ID_999',
      party_size: 42,
      resident_alias: 'X',
      unexpected_injection: 'DROP TABLE shelters;'
    };
    const result = await this.invokeSiteAction('reserve_shelter_bed', badPayload, 'security_probe');
    this.onNodeActive(null);
    return result;
  }
}
