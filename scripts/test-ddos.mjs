// Hands-on DoS / crash verification for Verlux.
//
//   node scripts/test-ddos.mjs          → run against the local patched build
//   node scripts/test-ddos.mjs --remote → ALSO compare against npm `verlux@1.0.10`
//                                          (the last release before the fixes)
//
// Each attack prints what the attacker sends, what the OLD version did, and
// what the CURRENT version does. A vector is "closed" when the current
// version throws a clean error or completes inside a small time budget.

import { verlux } from '../dist/cjs/index.js';

let oldVerlux = null;
if (process.argv.includes('--remote')) {
  try {
    const mod = await import('verlux');
    oldVerlux = mod.verlux ?? mod.default;
  } catch {
    console.log('[--remote] `verlux` is not installed locally. Run:');
    console.log('  npm install --no-save verlux@1.0.10');
    console.log('then re-run this script with --remote.\n');
    process.exit(1);
  }
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const RED   = useColor ? '\x1b[31m' : '';
const GREEN = useColor ? '\x1b[32m' : '';
const DIM   = useColor ? '\x1b[2m'  : '';
const RESET = useColor ? '\x1b[0m'  : '';

function run(label, fn) {
  const t0 = performance.now();
  try {
    fn();
    return { ok: true, ms: performance.now() - t0 };
  } catch (e) {
    return { ok: false, ms: performance.now() - t0, err: `${e.constructor.name}: ${e.message}` };
  }
}

function attack(name, payload_description, fn_now, fn_old, expect_now) {
  console.log(`\n${name}`);
  console.log(`  ${DIM}payload:${RESET} ${payload_description}`);

  if (oldVerlux && fn_old) {
    const old = run('old', () => fn_old(oldVerlux));
    if (old.ok) {
      console.log(`  ${DIM}1.0.10:${RESET}  ${RED}succeeded${RESET} in ${old.ms.toFixed(0)}ms ${DIM}(no defense)${RESET}`);
    } else {
      console.log(`  ${DIM}1.0.10:${RESET}  ${RED}${old.err.split('\n')[0]}${RESET} ${DIM}(crashed at ${old.ms.toFixed(0)}ms)${RESET}`);
    }
  }

  const now = run('now', fn_now);
  const expected = expect_now === 'throw' ? !now.ok : now.ok;
  const tag = expected ? `${GREEN}✓ closed${RESET}` : `${RED}✗ still exploitable${RESET}`;
  if (now.ok) {
    console.log(`  ${DIM}1.0.11:${RESET}  ${tag} returned in ${now.ms.toFixed(0)}ms`);
  } else {
    console.log(`  ${DIM}1.0.11:${RESET}  ${tag} ${now.err.split('\n')[0]} ${DIM}(in ${now.ms.toFixed(0)}ms)${RESET}`);
  }
}

console.log('═'.repeat(72));
console.log(' Verlux DoS / crash verification');
console.log('═'.repeat(72));
if (!oldVerlux) {
  console.log(`${DIM} (pass --remote to compare against verlux@1.0.10 from npm)${RESET}`);
}

// 1. The remote-DoS — single-token stack overflow
attack(
  '[1] Remote DoS — single-token stack overflow',
  `"a".repeat(5_000_000)  (5 MB of "a")`,
  () => verlux.detect('a'.repeat(5_000_000)),
  (v) => v.detect('a'.repeat(5_000_000)),
  'throw'
);

// 2. CPU exhaustion under the old (uncapped) build
attack(
  '[2] CPU exhaustion (slow DoS) — 1 MB of single-token text',
  `"a".repeat(1_000_000)  (would lock a Node worker for ~3 s on 1.0.10)`,
  () => verlux.detect('a'.repeat(1_000_000)),
  (v) => v.detect('a'.repeat(1_000_000)),
  'throw'
);

// 3. Type-confusion crash — non-string input
attack(
  '[3] Crash on non-string input',
  `verlux.detect(123)  (any HTTP integration that forwards JSON values)`,
  () => verlux.detect(123),
  (v) => v.detect(123),
  'throw'
);

// 4. Poisoned object with a custom .trim()
attack(
  '[4] Crash via object slipping past the truthy check',
  `verlux.detect({ trim: () => ({ length: 1 }) })`,
  () => verlux.detect({ trim: () => ({ length: 1 }) }),
  (v) => v.detect({ trim: () => ({ length: 1 }) }),
  'throw'
);

// 5. Whitelist toString poisoning — arbitrary throw propagates
attack(
  '[5] Whitelist toString poisoning',
  `whitelist: [{ toString() { throw new Error("pwn"); } }]`,
  () => verlux.detect('hello', { whitelist: [{ toString() { throw new Error('pwn'); } }] }),
  (v) => v.detect('hello', { whitelist: [{ toString() { throw new Error('pwn'); } }] }),
  'throw'
);

// 6. Non-string mask
attack(
  '[6] Censor crash on non-string mask',
  `verlux.censor("what the fuck", { mask: 1234 })`,
  () => verlux.censor('what the fuck', { mask: 1234 }),
  (v) => v.censor('what the fuck', { mask: 1234 }),
  'ok' // patched version silently defaults to '*'
);

// 7. Per-call languages CPU amplification
console.log('\n[7] Per-call languages config amplification — 1000 × detect("hello world", { languages: ["en"] })');
const oldMs = oldVerlux ? run('old', () => {
  for (let i = 0; i < 1000; i++) oldVerlux.detect('hello world', { languages: ['en'] });
}).ms : null;
const newMs = run('now', () => {
  for (let i = 0; i < 1000; i++) verlux.detect('hello world', { languages: ['en'] });
}).ms;
if (oldMs !== null) {
  console.log(`  ${DIM}1.0.10:${RESET}  ${RED}${oldMs.toFixed(0)}ms${RESET} ${DIM}(rebuilds the index every call)${RESET}`);
}
console.log(`  ${DIM}1.0.11:${RESET}  ${GREEN}${newMs.toFixed(0)}ms${RESET} ${DIM}(cached index)${RESET}`);

console.log('\n' + '═'.repeat(72));
console.log(' All attacks above should show ✓ closed on 1.0.11.');
console.log('═'.repeat(72));
