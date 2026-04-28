import { $expression, path } from './expression.js';
import { $literal } from './literal.js';
import type { Parser } from './pr.js';
import Pr from './pr.js';
import type { AssignmentStatement, ValueStatement, VariableStatement } from './statements.js';
import { char, optionalSpaces } from './utils.js';

export const $variable: Parser<VariableStatement> = Pr.regex(
  'variable',
  /^\$(?!(?:this|root|parent)\b)\w*/,
).map((name, loc) => ({
  type: 'VARIABLE',
  loc,
  name,
}));

// Expression statement for assignment only, doesn't allow parameters without parenthesis
const $assignmentExpression: Parser<ValueStatement> = Pr.context(
  'assignment expression',
  // eslint-disable-next-line func-names
  function* () {
    yield optionalSpaces;

    const hasOpenParen = yield Pr.optional(Pr.lookAhead(Pr.string('(')));
    if (hasOpenParen) {
      return yield $expression;
    }

    const literal = yield Pr.optional($literal);
    if (literal) {
      return literal;
    }

    const variable = yield Pr.optional($variable);
    if (variable) {
      return variable;
    }

    const pathExpr = yield Pr.optional(path);
    if (pathExpr) {
      return pathExpr;
    }

    yield Pr.fail('Expected literal, variable, path or parenthesized expression');
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
).map(({ type, loc: _, ...v }, loc) => ({ type, loc, ...v }));

// eslint-disable-next-line func-names
export const $assignment: Parser<AssignmentStatement> = Pr.context('assignment', function* () {
  yield char; // Consume '='
  yield optionalSpaces;
  const variable = yield $variable;
  yield optionalSpaces;
  const expression: ValueStatement = yield $assignmentExpression;

  yield optionalSpaces;
  const extraToken = yield Pr.optional(Pr.regex('extra token', /^[^\s}]+/));
  if (extraToken) {
    yield Pr.fail('Assignments require a single expression, use parenthesis for helpers');
  }

  return { variable, expression };
}).map((assignment, { start, end }) => ({
  type: 'ASSIGNMENT',
  loc: { start: start - 2, end: end + 2 },
  ...assignment,
}));
