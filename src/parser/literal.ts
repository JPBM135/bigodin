import type { Parser } from './pr.js';
import Pr from './pr.js';
import type { LiteralStatement } from './statements.js';
import { lString } from './string.js';

export const lNull = Pr.string('null')
  .map(() => null)
  .withName('null');

export const lUndefined = Pr.string('undefined')
  .map(() => void 0)
  .withName('undefined');

export const lBoolean = Pr.oneOf(Pr.string('true'), Pr.string('false'))
  .map((literalString) => literalString === 'true')
  .withName('boolean');

export const lNumber = Pr.regex('number', /^[+-]?\d+(\.\d+)?/).map(Number);

export const $literal: Parser<LiteralStatement> = Pr.either<
  boolean | number | string | null | undefined
>(lNull, lUndefined, lBoolean, lNumber, lString)
  .map((value, loc): LiteralStatement => ({ type: 'LITERAL', loc, value }))
  .withName('literal');
