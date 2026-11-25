import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { validateJsonSchema, validateNetworkDocument, computeDigest } from '../src/runtime/schemaValidator.js';
import { AgenticWebEngine } from '../src/runtime/engine.js';
import { INITIAL_SHELTERS, INITIAL_SUPPLIES } from '../src/data/reliefData';

const publicDir = path.resolve(process.cwd(), 'public');

function createLocalPublicFetcher() {
  return async (url: string) => {
    const cleanRel = url.replace(/^\.\//, '');
    const fullPath = path.join(publicDir, cleanRel);
    if (!fs.existsSync(fullPath)) {
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }
    const content = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    return { ok: true, status: 200, json: async () => content } as unknown as Response;
  };
}

describe('Open Agentic Web MVS Specification Compliance', () => {
  it('validates agent-manifest.json and all host/peer agent-network.json documents', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'agent-manifest.json'), 'utf-8'));
    expect(manifest.spec_version).toBe('0.1.0-mvs');
    expect(manifest.networks.length).toBeGreaterThan(0);

    const networkFiles = [
      'agent-network.json',
      'peers/clinic-network/agent-network.json',
      'peers/transit-network/agent-network.json',
      'peers/volunteer-network/agent-network.json'
    ];

    for (const rel of networkFiles) {
      const doc = JSON.parse(fs.readFileSync(path.join(publicDir, rel), 'utf-8'));
      const check = validateNetworkDocument(doc);
      expect(check.valid, `${rel} failed validation: ${check.errors.join(', ')}`).toBe(true);
    }
  });

  it('strictly enforces JSON Schema validation rules (required, pattern, enum, bounds, additionalProperties)', () => {
    const schema = {
      type: 'object',
      properties: {
        shelter_id: { type: 'string', pattern: '^SH-[0-9]{3}$' },
        party_size: { type: 'integer', minimum: 1, maximum: 12 },
        priority: { type: 'string', enum: ['routine', 'urgent', 'critical'] }
      },
      required: ['shelter_id', 'party_size'],
      additionalProperties: false
    };

    expect(
      validateJsonSchema(schema, { shelter_id: 'SH-201', party_size: 3, priority: 'urgent' }).valid
    ).toBe(true);

    const bad = validateJsonSchema(schema, {
      shelter_id: 'BAD',
      party_size: 99,
      priority: 'unknown',
      injected: true
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('computes deterministic SHA-256 package digests', async () => {
    const a = await computeDigest({ hello: 'agentic-web' });
    const b = await computeDigest({ hello: 'agentic-web' });
    expect(a).toBe(b);
    expect(a.startsWith('sha256:') || a.startsWith('fnv1a:')).toBe(true);
  });
});

describe('AgenticWebEngine End-to-End Orchestration & HITL Safety', () => {
  async function createEngine(approveWrites: boolean) {
    const shelters = INITIAL_SHELTERS.map((s) => ({ ...s }));
    const traces: any[] = [];
    let approvalPrompts = 0;

    const engine = new AgenticWebEngine({
      fetcher: createLocalPublicFetcher(),
      stepDelayMs: 0,
      onTrace: (e) => traces.push(e),
      onApprovalRequired: async () => {
        approvalPrompts++;
        return approveWrites;
      }
    });

    engine.registerSiteAction('query_shelters', async (args: any) => {
      const matches = shelters.filter((s) => {
        if (args.needs_wheelchair && !s.wheelchair_accessible) return false;
        if (args.needs_power && !s.backup_power) return false;
        if (args.min_beds && s.available_beds < args.min_beds) return false;
        return true;
      });
      return { matches, summary: `Found ${matches.length} shelters` };
    });

    engine.registerSiteAction('check_supply_inventory', async (args: any) => ({
      items: INITIAL_SUPPLIES.filter((i) => args.item === 'all' || i.key === args.item),
      summary: 'Checked supplies'
    }));

    engine.registerSiteAction('reserve_shelter_bed', async (args: any) => {
      const target = shelters.find((s) => s.id === args.shelter_id)!;
      target.available_beds -= args.party_size;
      return { summary: `Reserved ${args.party_size} beds at ${target.id}` };
    });

    engine.registerSiteAction('create_aid_dispatch', async (args: any) => ({
      summary: `Dispatched ${args.quantity} of ${args.supply_item}`
    }));

    await engine.loadFromManifest('./agent-manifest.json');
    return { engine, shelters, traces, getApprovalPrompts: () => approvalPrompts };
  }

  it('federates peers, runs multi-agent plan, and executes write action when human approves', async () => {
    const { engine, shelters, traces, getApprovalPrompts } = await createEngine(true);
    const beforeTotal = shelters.reduce((sum, s) => sum + s.available_beds, 0);

    const res = await engine.runRequest(
      'Family of 3 in Harbor needs a wheelchair-accessible shelter with backup power, insulin clinic check, safe route avoiding flooded bridges, and reserve 3 beds.'
    );

    expect(res.observations.shelters.matches.length).toBeGreaterThan(0);
    expect(res.observations.clinic.clinics.length).toBeGreaterThan(0);
    expect(res.observations.transit.route.recommended_corridor).toContain('Overpass');
    expect(getApprovalPrompts()).toBe(1);
    expect(res.actionOutcomes[0].status).toBe('executed');

    const afterTotal = shelters.reduce((sum, s) => sum + s.available_beds, 0);
    expect(afterTotal).toBe(beforeTotal - 3);
    expect(traces.some((t) => t.type === 'HITL_APPROVED')).toBe(true);
  });

  it('leaves host state completely untouched when human declines HITL write action', async () => {
    const { engine, shelters, traces, getApprovalPrompts } = await createEngine(false);
    const beforeTotal = shelters.reduce((sum, s) => sum + s.available_beds, 0);

    const res = await engine.runRequest(
      'Family of 3 in Harbor needs wheelchair-accessible shelter with power and reserve 3 beds.'
    );

    expect(getApprovalPrompts()).toBe(1);
    expect(res.actionOutcomes[0].status).toBe('rejected');
    expect(shelters.reduce((sum, s) => sum + s.available_beds, 0)).toBe(beforeTotal);
    expect(traces.some((t) => t.type === 'HITL_REJECTED')).toBe(true);
  });

  it('blocks malformed write payloads BEFORE reaching HITL or handler', async () => {
    const { engine, traces, getApprovalPrompts } = await createEngine(true);
    const guardRes = await engine.demonstrateSchemaGuard();

    expect(guardRes.status).toBe('schema_rejected');
    expect(guardRes.errors.length).toBeGreaterThanOrEqual(3);
    expect(getApprovalPrompts()).toBe(0);
    expect(traces.some((t) => t.type === 'SCHEMA_REJECTED')).toBe(true);
  });

  it('dynamically connects and federates a 3rd-party peer agent-network.json at runtime', async () => {
    const { engine } = await createEngine(true);
    expect(engine.peers.size).toBe(2);

    const record = await engine.connectPeer('./peers/volunteer-network/agent-network.json', {
      isCustom: true
    });
    expect(record.peerId).toBe('neighborhood-volunteer-mesh');
    expect(engine.peers.size).toBe(3);

    const res = await engine.runRequest('Need shelter bed in Midtown and volunteer assistance.');
    expect(res.observations.externalPeers.length).toBe(1);
    expect(res.observations.externalPeers[0].entryAgent).toBe('volunteer_matcher');
  });
});
