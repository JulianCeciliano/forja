// Stop / SubagentStop: registra tokens reales leídos del transcript en .forja/metrics.jsonl.
// Sirve para el A/B (con y sin Graphify/Caveman) y para /forja:retro. Nunca falla ni imprime.
import fs from 'node:fs';
import { forjaPaths, hasForja, loadState, projectDir, readInput } from './lib.mjs';

function sumUsage(file) {
  const t = { in: 0, out: 0, cache_read: 0, cache_write: 0, msgs: 0 };
  const seen = new Set();
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return t;
  }
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = o.message || {};
    const u = msg.usage || o.usage;
    if (!u) continue;
    const id = msg.id || o.uuid;
    if (id) {
      if (seen.has(id)) continue; // un mismo mensaje se repite por bloque de contenido
      seen.add(id);
    }
    t.in += u.input_tokens || 0;
    t.out += u.output_tokens || 0;
    t.cache_read += u.cache_read_input_tokens || 0;
    t.cache_write += u.cache_creation_input_tokens || 0;
    t.msgs += 1;
  }
  return t;
}

try {
  const input = readInput();
  const root = projectDir(input);
  if (!hasForja(root)) process.exit(0);

  const event = input.hook_event_name || 'Stop';
  const transcript = event === 'SubagentStop' ? input.agent_transcript_path : input.transcript_path;
  if (!transcript) process.exit(0);

  const state = loadState(root);
  const line = {
    ts: new Date().toISOString(),
    event,
    session: input.session_id || null,
    feature: state.feature,
    level: state.level,
    agent: input.agent_type || null,
    ...sumUsage(transcript),
  };
  fs.appendFileSync(forjaPaths(root).metrics, `${JSON.stringify(line)}\n`);
} catch {
  /* métricas son best-effort */
}
process.exit(0);
