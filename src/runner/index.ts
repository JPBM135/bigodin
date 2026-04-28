import type { ExpressionStatement, Statement, TemplateStatement } from '../parser/statements.js';
import { deepCloneNullPrototype } from '../utils.js';
import { runBlock } from './block.js';
import { Execution } from './execution.js';
import { runHelperExpression } from './helper.js';
import { helpers } from './helpers/index.js';
import type { Helper } from './helpers/type.js';
import type { BigodinOptions } from './options.js';
import { runPathExpression } from './path-expression.js';
import { runAssignment, runVariable } from './variables.js';

export type LiteralValue = boolean | number | object | string | null | undefined;

const MIN_VERSION = 1;
const MAX_VERSION = 4;

export async function run(
  ast: TemplateStatement,
  // eslint-disable-next-line @typescript-eslint/default-param-last
  context: object = {},
  extraHelpers: Map<string, Helper>,
  options?: BigodinOptions,
): Promise<string> {
  if (ast.version < MIN_VERSION || ast.version > MAX_VERSION) {
    throw new Error(`Unsupported AST version ${ast.version}, parse it again to generate a new AST`);
  }

  const ctx = deepCloneNullPrototype(context);
  const execution = Execution.of(ctx, extraHelpers, options);
  return runStatements(execution, ast.statements);
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
    if (stmtResult === null || typeof stmtResult === 'undefined') {
      continue;
    }

    if (typeof stmtResult === 'object') {
      result += Object.prototype.toString.call(stmtResult);
      continue;
    }

    result += String(stmtResult);
  }

  return result;
}

export async function runStatement(
  execution: Execution,
  statement: Statement,
): Promise<LiteralValue> {
  if (execution.elapsedMillis > execution.maxExecutionMillis) {
    throw new Error(`Execution time limit exceeded`);
  }

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
  if (execution.extraHelpers.has(expression.path) || helpers[expression.path]) {
    return runHelperExpression(execution, expression);
  }

  // Otherwise, it's a path expression
  return runPathExpression(execution, expression);
}
