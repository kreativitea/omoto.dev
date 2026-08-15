/* Emits the chosen stroke as static markup to paste into base.njk.
 * The masthead mark is authored, not computed — it should not cost a build
 * step or a runtime, so the generator's job ends here. */
import { OPTIONS, render } from './strokes.mjs';

const id = process.argv[2] || 'tucked';
const len = Number(process.argv[3] || 640);
const samples = Number(process.argv[4] || 150);

const o = OPTIONS.find((x) => x.id === id);
if (!o) throw new Error(`no option "${id}"`);

// render() bakes at the default sample count; re-run its internals via a
// direct call so the sample count is controllable for the shipped version.
const out = render(o, len, '', samples);
const body = out.svg;

console.log(`--- ${o.name} @ ${len}px, ${samples} samples ---`);
console.log(`bytes: ${body.length}`);
console.log(body);
console.log('--- filter ---');
console.log(out.filterDef);
