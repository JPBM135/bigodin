import type { Execution } from '../execution.js';

const hIf = Boolean;
const hUnless = (a: any) => !a;
// `with` is handled natively in runBlock (it pushes each truthy argument
// onto the context stack as a separate frame). The helper itself is kept
// in the registry so block-expression name resolution still treats `with`
// as a helper; outside of a block its return value is intentionally
// undefined.
const hWith = (): undefined => undefined;
const hEach = (a: any) => (Array.isArray(a) ? a : [a]);
// eslint-disable-next-line func-style
const hReturn = function (this: Execution): '' {
  this.halt();
  return '' as const;
};

export const codeHelpers = Object.assign(Object.create(null), {
  if: hIf,
  unless: hUnless,
  with: hWith,
  each: hEach,
  return: hReturn,
});
