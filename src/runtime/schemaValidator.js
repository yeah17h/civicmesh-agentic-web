/**
 * CivicMesh Open Agentic Web Runtime — Strict JSON Schema Validator & Integrity Digest
 * Conforms to the Worldwide Agentic Web MVS requirement for strict argument validation
 * before invoking any agent, peer capability, or local site action.
 */

export function validateJsonSchema(schema, value, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') {
    return { valid: true, errors };
  }

  if (schema.type) {
    const typeOk = checkType(schema.type, value);
    if (!typeOk) {
      errors.push(`${path}: expected type "${schema.type}", received "${describeType(value)}"`);
      return { valid: false, errors };
    }
  }

  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: value "${String(value)}" must be one of [${schema.enum.join(', ')}]`);
  }

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && value.length < schema.minLength) {
      errors.push(`${path}: length ${value.length} is shorter than minLength ${schema.minLength}`);
    }
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) {
      errors.push(`${path}: length ${value.length} exceeds maxLength ${schema.maxLength}`);
    }
    if (typeof schema.pattern === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`${path}: value "${value}" does not match pattern /${schema.pattern}/`);
      }
    }
  }

  if (typeof value === 'number') {
    if (typeof schema.minimum === 'number' && value < schema.minimum) {
      errors.push(`${path}: value ${value} is less than minimum ${schema.minimum}`);
    }
    if (typeof schema.maximum === 'number' && value > schema.maximum) {
      errors.push(`${path}: value ${value} exceeds maximum ${schema.maximum}`);
    }
  }

  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const props = schema.properties || {};
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (value[reqKey] === undefined || value[reqKey] === null || value[reqKey] === '') {
          errors.push(`${path}.${reqKey}: required property is missing`);
        }
      }
    }

    for (const [key, propVal] of Object.entries(value)) {
      if (propVal === undefined) continue;
      if (props[key]) {
        const sub = validateJsonSchema(props[key], propVal, `${path}.${key}`);
        if (!sub.valid) {
          errors.push(...sub.errors);
        }
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key}: additional property is not allowed by schema`);
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, idx) => {
      const sub = validateJsonSchema(schema.items, item, `${path}[${idx}]`);
      if (!sub.valid) {
        errors.push(...sub.errors);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function checkType(expected, value) {
  switch (expected) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !Number.isNaN(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
    default:
      return true;
  }
}

function describeType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function validateNetworkDocument(doc) {
  const errors = [];
  if (!doc || typeof doc !== 'object') {
    return { valid: false, errors: ['Agent network document must be a JSON object'] };
  }
  if (!doc.network_id || typeof doc.network_id !== 'string') {
    errors.push('Missing required string field: network_id');
  }
  if (!doc.entry_agent || typeof doc.entry_agent !== 'string') {
    errors.push('Missing required string field: entry_agent');
  }
  if (!Array.isArray(doc.agents) || doc.agents.length === 0) {
    errors.push('Field "agents" must be a non-empty array');
  } else {
    const names = new Set();
    for (const agent of doc.agents) {
      if (!agent.name) errors.push('Each agent must have a "name"');
      if (names.has(agent.name)) errors.push(`Duplicate agent name "${agent.name}"`);
      names.add(agent.name);
      if (!agent.function || !agent.function.description || !agent.function.parameters) {
        errors.push(`Agent "${agent.name || 'unknown'}" must declare function.description and function.parameters`);
      }
      if (!agent.instructions) {
        errors.push(`Agent "${agent.name || 'unknown'}" must declare instructions`);
      }
    }
    if (doc.entry_agent && !names.has(doc.entry_agent)) {
      errors.push(`entry_agent "${doc.entry_agent}" not found in agents array`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Computes a SHA-256 package digest (inspired by MIT NANDA verifiable agent packages)
 * so browsers and peers can inspect manifest integrity client-side.
 */
export async function computeDigest(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (globalThis.crypto && globalThis.crypto.subtle) {
    const data = new TextEncoder().encode(text);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(hashBuffer));
    return 'sha256:' + bytes.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }
  // Lightweight deterministic fallback for constrained environments
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 'fnv1a:' + (hash >>> 0).toString(16).padStart(8, '0');
}
