import * as plugin from './lib/index.js';

/** Hard validation the DSH core applies to every candidate name. */
const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Expected candidate count; bump together with skills/ / README.md / package.json description. */
const EXPECTED_COUNT = 37;

let failures = 0;
function check(label, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

// dsh provides the `skills` service; we mock just enough of it to capture the
// provider factory. registerProvider hands the factory a SkillProviderControl
// on the 0.2.0-rc.2 seam — supply a live signal the same way the host does.
const factories = [];
const fakeCtx = {
  skills: { registerProvider: (fn) => factories.push(fn) },
};
plugin.apply(fakeCtx);
check('provider factory registered', factories.length === 1, `got ${factories.length}`);

const control = { signal: new AbortController().signal, invalidate() {} };
const provider = factories[0](control);

const observation = await provider.list();
const list = observation.candidates;
console.log('plugin export name     :', plugin.name);
console.log('inject                 :', JSON.stringify(plugin.inject));
console.log('observation.complete   :', observation.complete);
console.log('total candidates       :', list.length);

check('list() returns complete observation', observation.complete === true);

const names = list.map((c) => c.name);
const uniq = new Set(names);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
console.log('unique candidate names :', uniq.size);
console.log('duplicate names        :', dupes.length ? [...new Set(dupes)] : 'none');

const badNames = names.filter((n) => !SKILL_NAME.test(n));
check(
  `every candidate name matches ${SKILL_NAME}`,
  badNames.length === 0,
  badNames.length ? `illegal: ${badNames.join(', ')}` : `${names.length} checked`,
);
check('no duplicate candidate names', dupes.length === 0, dupes.length ? [...new Set(dupes)].join(', ') : '');
check(`candidate count is ${EXPECTED_COUNT}`, list.length === EXPECTED_COUNT, `got ${list.length}`);
check('every candidate carries a path (SkillSummary contract)', list.every((c) => typeof c.path === 'string' && c.path.length > 0));
check('every candidate provider field is set', list.every((c) => c.provider === plugin.name));

const userInv = list.filter((c) => c.invocation.userInvocable).length;
const modelInv = list.filter((c) => c.invocation.modelInvocable).length;
console.log('userInvocable          :', userInv, '/', list.length);
console.log('modelInvocable         :', modelInv, '/', list.length);
check('all skills model-invocable', modelInv === list.length);

console.log('\nsample candidates:');
for (const c of list.slice(0, 6)) {
  console.log('  -', c.name, '::', c.description.slice(0, 60));
}

// Block scalars: the distilled skills write `description: |`; make sure the
// value is real prose, not the literal indicator (issue #4 pattern).
const withBlockDesc = list.find((c) => c.description.startsWith('从明·张介宾'));
check(
  'block-scalar description parsed as prose',
  withBlockDesc !== undefined && withBlockDesc.description.length > 40,
  withBlockDesc ? `"${withBlockDesc.description.slice(0, 40)}…"` : 'liejing-tuyi-yunqi description not found',
);

// verify on-demand body fetch via get()
const got = await provider.get(list[0]);
console.log('\nget() first candidate   :', got.name, '| body chars:', got.content.length);
console.log('get() provider field    :', got.provider);
check('get() returns non-empty body', typeof got.content === 'string' && got.content.length > 0);

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
