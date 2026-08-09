/**
 * Take a Hermes CPU sampling profile of a live interaction, over Metro's CDP
 * inspector.
 *
 * Why this exists: the three worst JS blocks in the swipe capture had no
 * instrumented span open during them, so the cost sits in a path nothing
 * measures. Four earlier hypotheses about chapter-open died on exactly that
 * kind of gap. A sampling profile does not need a hypothesis — it names the
 * functions that were on the stack.
 *
 * Usage: bun scripts/perf/hermes-profile.ts <seconds> <out.cpuprofile>
 * Set METRO_HOST to point at a different Metro (default is ThorSPC on the LAN).
 * The caller drives the gesture (adb input swipe) while this runs.
 */

const [secsArg, outPath] = process.argv.slice(2);
const seconds = Number(secsArg ?? 12);
const out = outPath ?? '/tmp/hermes.cpuprofile';
const HOST = process.env.METRO_HOST ?? '192.168.0.193:8081';

const targets = (await (await fetch(`http://${HOST}/json/list`)).json()) as {
  title: string;
  description?: string;
  webSocketDebuggerUrl: string;
  reactNative?: { capabilities?: { prefersFuseboxFrontend?: boolean } };
}[];
if (targets.length === 0) throw new Error('no inspector targets — is the app running?');
// Pick the JS runtime, not the "UI" connection. Metro lists both; the UI page
// accepts a websocket and then answers NOTHING — Profiler.start simply never
// replied, which looked like "Hermes has no profiler" rather than "wrong
// target". The JS runtime is the one advertising the Fusebox frontend.
const jsTarget =
  targets.find((t) => t.reactNative?.capabilities?.prefersFuseboxFrontend) ??
  targets.find((t) => /bridgeless/i.test(t.description ?? ''));
if (!jsTarget)
  throw new Error(`no JS runtime target among: ${targets.map((t) => t.description).join(', ')}`);
const url = jsTarget.webSocketDebuggerUrl;
console.error(`connecting: ${url}`);

const ws = new WebSocket(url);
let id = 0;
const pending = new Map<number, (v: any) => void>();

function send(method: string, params: Record<string, unknown> = {}): Promise<any> {
  id += 1;
  const myId = id;
  ws.send(JSON.stringify({ id: myId, method, params }));
  return new Promise((resolve) => pending.set(myId, resolve));
}

ws.onmessage = (e) => {
  const msg = JSON.parse(String(e.data));
  if (msg.error) console.error(`  <- error for id=${msg.id}: ${JSON.stringify(msg.error)}`);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)?.(msg);
    pending.delete(msg.id);
  } else if (msg.id) {
    console.error(`  <- unmatched id=${msg.id}`);
  }
};

await new Promise<void>((resolve, reject) => {
  ws.onopen = () => resolve();
  ws.onerror = (err) => reject(new Error(`ws failed: ${String(err)}`));
});

// Hermes does not answer Profiler.enable, so it is fired and not awaited —
// awaiting it hung the whole run with no error on either side.
console.error('starting profiler');
void send('Profiler.enable');
const started = await Promise.race([
  send('Profiler.start'),
  new Promise((r) => setTimeout(() => r({ timeout: true }), 5000)),
]);
console.error(`  Profiler.start -> ${JSON.stringify(started).slice(0, 200)}`);
console.error(`profiling for ${seconds}s — drive the interaction NOW`);
await new Promise((r) => setTimeout(r, seconds * 1000));

const stopped = await send('Profiler.stop');
const profile = stopped?.result?.profile;
if (!profile) throw new Error(`no profile returned: ${JSON.stringify(stopped).slice(0, 400)}`);

await Bun.write(out, JSON.stringify(profile));
console.error(
  `wrote ${out} — ${profile.nodes?.length ?? 0} nodes, ${profile.samples?.length ?? 0} samples`
);
ws.close();
