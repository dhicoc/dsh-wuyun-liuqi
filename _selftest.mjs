import * as plugin from './lib/index.js';

// dsh provides the `skills` service; we mock just enough of it to capture providers.
const providers = [];
const fakeCtx = {
  skills: { registerProvider: (fn) => providers.push(fn) },
};

plugin.apply(fakeCtx);

const list = await providers[0]().list();
console.log('plugin export name     :', plugin.name);
console.log('inject                 :', JSON.stringify(plugin.inject));
console.log('providers registered   :', providers.length);
console.log('total candidates       :', list.length);

const names = list.map((c) => c.name);
const uniq = new Set(names);
console.log('unique candidate names :', uniq.size);
const dupes = names.filter((n, i) => names.indexOf(n) !== i);
console.log('duplicate names        :', dupes.length ? [...new Set(dupes)] : 'none');

const userInv = list.filter((c) => c.invocation.userInvocable).length;
const modelInv = list.filter((c) => c.invocation.modelInvocable).length;
console.log('userInvocable          :', userInv, '/', list.length);
console.log('modelInvocable         :', modelInv, '/', list.length);

console.log('\nsample candidates:');
for (const c of list.slice(0, 6)) {
  console.log('  -', c.name, '::', c.description.slice(0, 60));
}

// verify on-demand body fetch via get()
const got = await providers[0]().get(list[0]);
console.log('\nget() first candidate   :', got.name, '| body chars:', got.content.length);
console.log('get() provider field    :', got.provider);
