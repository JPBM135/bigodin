import * as pierrejsNs from 'pierrejs';
import type { Parser } from 'pierrejs';

// pierrejs is published as CJS and exposes its parser combinators as the
// module's `default` export. Node's ESM->CJS interop hands us
// `module.exports` itself when we ask for the default, so the combinators
// actually live one level deeper at runtime under ESM. The CJS emit (with
// esModuleInterop's __importStar shim) lands on the same shape, so the
// `default ?? self` unwrap below works under both module systems.
//
// TypeScript types this differently between the two builds (legacy CJS
// resolution unwraps the d.ts default for us; nodenext does not), so the
// conditional type below collapses both shapes onto the real combinators.
type NsDefault = typeof pierrejsNs.default;
type Combinators = NsDefault extends { string(s: string): Parser<string> }
  ? NsDefault
  : NsDefault extends { default: { string(s: string): Parser<string> } }
    ? NsDefault['default']
    : never;

const candidate = pierrejsNs.default as Combinators | { default?: Combinators };
const Pr: Combinators =
  (candidate as { default?: Combinators }).default ?? (candidate as Combinators);

export default Pr;
export type { Parser, Result, State } from 'pierrejs';
