import type { Execution } from '../execution.js';

const hIf = Boolean;
const hUnless = (a: any) => !a;
const hWith = (a: any) => [a];
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
