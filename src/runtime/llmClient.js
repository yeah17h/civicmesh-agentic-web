/**
 * CivicMesh Open Agentic Web Runtime — BYOK Browser LLM Client
 * Supports Mozilla Otari, OpenAI-compatible endpoints, Google Gemini, Local Ollama,
 * and Zero-Key Deterministic Demo synthesis so site hosts incur $0 LLM inference costs.
 */

export const LLM_PROVIDER_PRESETS = {
  'demo-deterministic': {
    id: 'demo-deterministic',
    label: 'Built-in Zero-Key Demo Mode',
    baseUrl: '',
    defaultModel: 'civicmesh-deterministic-planner-v1',
    requiresKey: false,
    description: 'Runs full MVS orchestration, real JSON Schema checks, live peer fetches, and HITL approvals with no API key required.'
  },
  'mozilla-otari': {
    id: 'mozilla-otari',
    label: 'Mozilla Otari / OpenAI-Compatible Gateway',
    baseUrl: 'https://api.otari.mozilla.ai/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    requiresKey: true,
    description: 'Uses Mozilla Otari or any OpenAI-compatible gateway directly from your browser using your own key.'
  },
  'openai-compatible': {
    id: 'openai-compatible',
    label: 'OpenAI / Custom OpenAI-Compatible API',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    requiresKey: true,
    description: 'Direct client-side BYOK calls to OpenAI, OpenRouter, Together, or Groq.'
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini API (BYOK)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    defaultModel: 'gemini-2.5-flash',
    requiresKey: true,
    description: 'Direct client-side BYOK calls to Google Gemini REST API.'
  },
  'ollama-local': {
    id: 'ollama-local',
    label: 'Local Ollama (Privacy-First Local LLM)',
    baseUrl: 'http://localhost:11434/v1/chat/completions',
    defaultModel: 'llama3.2',
    requiresKey: false,
    description: 'Calls a local Ollama model on your own machine with zero cloud keys.'
  }
};

export async function generateCoordinatorSummary({ llmConfig, userRequest, observations, actionOutcomes }) {
  const provider = llmConfig?.provider || 'demo-deterministic';

  if (provider === 'demo-deterministic') {
    return buildDeterministicSummary(userRequest, observations, actionOutcomes);
  }

  const preset = LLM_PROVIDER_PRESETS[provider] || LLM_PROVIDER_PRESETS['openai-compatible'];
  const apiKey = (llmConfig?.apiKey || '').trim();
  const baseUrl = (llmConfig?.baseUrl || preset.baseUrl || '').trim();
  const model = (llmConfig?.model || preset.defaultModel || 'gpt-4o-mini').trim();

  if (preset.requiresKey && !apiKey) {
    return {
      text:
        buildDeterministicSummary(userRequest, observations, actionOutcomes).text +
        '\n\n_(No API key supplied for selected BYOK provider — fell back cleanly to local deterministic synthesizer.)_',
      usedProvider: 'demo-fallback',
      model: 'civicmesh-deterministic-planner-v1'
    };
  }

  const systemPrompt =
    'You are CivicMesh Relief Coordinator running in an Open Agentic Web browser runtime. ' +
    'Synthesize a concise, calm, actionable emergency coordination brief strictly grounded in the verified tool & peer network JSON results provided. ' +
    'Highlight shelter availability, federated clinic stock, safe transit corridors avoiding hazards, and whether human-approved write actions succeeded or were declined. Use clear bullet points.';

  const userPayload = JSON.stringify(
    {
      resident_request: userRequest,
      verified_observations: observations,
      write_action_outcomes: actionOutcomes
    },
    null,
    2
  );

  try {
    if (provider === 'gemini') {
      const url = `${baseUrl}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPayload }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
        })
      });
      if (!res.ok) {
        throw new Error(`Gemini HTTP ${res.status}`);
      }
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty Gemini response');
      return { text, usedProvider: provider, model };
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const res = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPayload }
        ]
      })
    });
    if (!res.ok) {
      throw new Error(`Provider HTTP ${res.status}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('Empty completion response');
    return { text, usedProvider: provider, model };
  } catch (err) {
    const fallback = buildDeterministicSummary(userRequest, observations, actionOutcomes);
    return {
      text: `${fallback.text}\n\n_(Live BYOK call to ${provider} failed: ${err.message}. Preserved verified deterministic synthesis.)_`,
      usedProvider: `${provider}-fallback`,
      model
    };
  }
}

export function buildDeterministicSummary(userRequest, observations, actionOutcomes) {
  const lines = [];
  lines.push('### Coordinated Relief Plan (Verified Across Federated Networks)');

  if (observations.shelters?.matches?.length > 0) {
    const top = observations.shelters.matches[0];
    lines.push(
      `- **Recommended Shelter (Host Network)**: **${top.name}** (\`${top.id}\`, ${top.district}) — **${top.available_beds} beds open**, wheelchair access: ${top.wheelchair_accessible ? 'Yes' : 'No'}, backup power: ${top.backup_power ? 'Yes' : 'No'}.`
    );
  } else if (observations.shelters) {
    lines.push('- **Shelter Search**: No exact district match found; check neighboring districts on the live board.');
  }

  if (observations.supplies?.items?.length > 0) {
    const summary = observations.supplies.items
      .slice(0, 3)
      .map((i) => `${i.label}: ${i.quantity} units (${i.hub})`)
      .join(' · ');
    lines.push(`- **Verified Supply Stock (Host Network)**: ${summary}.`);
  }

  if (observations.clinic?.clinics?.length > 0) {
    const c = observations.clinic.clinics[0];
    lines.push(
      `- **Medical Triage (Peer: Metro Clinic Network)**: **${c.name}** (${c.district}, ${c.open_24h ? '24h open' : 'day hours'}, ~${c.wait_minutes} min wait) — ${observations.clinic.medical_need} stock: **${c.stock_for_need} units** (${c.distance_to_nearest_shelter}).`
    );
  }

  if (observations.transit?.route) {
    const r = observations.transit.route;
    lines.push(
      `- **Safe Transit Corridor (Peer: SafeRoute Network)**: Take **${r.recommended_corridor}** (~${r.eta_minutes} min, wheelchair accessible: ${r.wheelchair_accessible ? 'Yes' : 'No'}). Avoids: *${r.avoids}*.`
    );
  }

  if (observations.externalPeers?.length > 0) {
    for (const ext of observations.externalPeers) {
      lines.push(`- **External Federated Peer (${ext.networkName})**: Discovered entry agent \`${ext.entryAgent}\` (${ext.digest}) — ${ext.summary}`);
    }
  }

  if (actionOutcomes.length > 0) {
    lines.push('');
    lines.push('#### Human-in-the-Loop Action Outcomes');
    for (const act of actionOutcomes) {
      if (act.status === 'executed') {
        lines.push(`- **APPROVED & EXECUTED** \`${act.action}\`: ${act.message}`);
      } else if (act.status === 'rejected') {
        lines.push(`- **DECLINED BY USER** \`${act.action}\`: Site state left unchanged.`);
      } else if (act.status === 'schema_rejected') {
        lines.push(`- **BLOCKED BY SCHEMA VALIDATOR** \`${act.action}\`: ${act.message}`);
      }
    }
  }

  return {
    text: lines.join('\n'),
    usedProvider: 'demo-deterministic',
    model: 'civicmesh-deterministic-planner-v1'
  };
}
