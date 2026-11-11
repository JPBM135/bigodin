import type { ExpressionStatement, Statement, TemplateStatement } from '../parser/statements.js';
import { deepCloneNullPrototype } from '../utils.js';
import { runBlock } from './block.js';
import { isError } from './error.js';
import { Execution } from './execution.js';
import { runHelperExpression } from './helper.js';
import { helpers } from './helpers/index.js';
import type { Helper } from './helpers/type.js';
import type { BigodinOptions } from './options.js';
import { runPathExpression } from './path-expression.js';
import { runAssignment, runVariable } from './variables.js';

export type LiteralValue = boolean | number | object | string | null | undefined;

const MIN_VERSION = 1;
const MAX_VERSION = 5;

export async function run(
  ast: TemplateStatement,
  // eslint-disable-next-line @typescript-eslint/default-param-last
  context: object = {},
  extraHelpers: Map<string, Helper>,
  options?: BigodinOptions,
): Promise<string> {
  if (!Number.isInteger(ast.version) || ast.version < MIN_VERSION || ast.version > MAX_VERSION) {
    throw new Error(`Unsupported AST version ${ast.version}, parse it again to generate a new AST`);
  }

  const ctx = deepCloneNullPrototype(context);
  const execution = Execution.of(ctx, extraHelpers, options);
  return runStatements(execution, ast.statements);
}

// Coerces a non-null object value to its rendered string. Arrays render the
// way Handlebars does (elements coerced and comma-joined, recursing into
// nested arrays); any other object becomes the `[object Object]` sentinel.
// We can't use `String(value)` because context objects are deep-cloned to a
// null prototype and so have no own/inherited `toString`, which would throw.
// An array that contains itself renders as an empty string at the point of
// the cycle, matching `Array.prototype.join`, instead of recursing forever.
function coerceObjectValue(value: object, ancestors: Set<object> = new Set()): string {
  if (!Array.isArray(value)) {
    return Object.prototype.toString.call(value);
  }

  if (ancestors.has(value)) {
    return '';
  }

  ancestors.add(value);
  const result = value
    .map((element) => {
      if (element === null || typeof element === 'undefined' || isError(element)) {
        return '';
      }

      return typeof element === 'object' ? coerceObjectValue(element, ancestors) : String(element);
    })
    .join(',');
  ancestors.delete(value);
  return result;
}

export async function runStatements(
  execution: Execution,
  statements: Statement[],
): Promise<string> {
  let result = '';

  for (const statement of statements) {
    if (execution.isHalted) {
      break;
    }

    const stmtResult = await runStatement(execution, statement);
    if (stmtResult === null || typeof stmtResult === 'undefined' || isError(stmtResult)) {
      continue;
    }

    const output =
      typeof stmtResult === 'object' ? coerceObjectValue(stmtResult) : String(stmtResult);

    // A block's result is made of output its own statements already accounted
    // for, so only leaf statements count towards the output budget.
    if (statement.type !== 'BLOCK') {
      execution.addOutput(output.length);
    }

    result += output;
  }

  return result;
}

export async function runStatement(
  execution: Execution,
  statement: Statement,
): Promise<LiteralValue> {
  execution.tick();

  switch (statement.type) {
    case 'TEXT':
      return statement.value;
    case 'COMMENT':
      return null;
    case 'LITERAL':
      return statement.value;
    case 'MUSTACHE':
      return runStatement(execution, statement.expression);
    case 'EXPRESSION':
      return runExpression(execution, statement);
    case 'BLOCK':
      return runBlock(execution, statement);
    case 'ASSIGNMENT':
      return runAssignment(execution, statement);
    case 'VARIABLE':
      return runVariable(execution, statement);
    /* v8 ignore start */
    case 'TEMPLATE':
      // Shouldn't happen, only here for TS's exhaustiveness checking below
      throw new Error('Template statements cannot be nested');
    default:
      statement satisfies never;
      return null;
    /* v8 ignore stop */
  }
}

async function runExpression(
  execution: Execution,
  expression: ExpressionStatement,
): Promise<LiteralValue> {
  // If there are parameters, the expression is a helper call
  if (expression.params.length > 0) {
    return runHelperExpression(execution, expression);
  }

  // If there are no parameters but a helper exists with that name, the expression is a helper call
  if (
    execution.extraHelpers.has(expression.path) ||
    (execution.allowDefaultHelpers && helpers[expression.path])
  ) {
    return runHelperExpression(execution, expression);
  }

  // Otherwise, it's a path expression
  return runPathExpression(execution, expression);
}
