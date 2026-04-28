import type { ExpressionStatement } from '../parser/statements.js';
import { lookupOwnValue } from '../utils.js';
import type { Execution } from './execution.js';
import type { LiteralValue } from './index.js';

export function runPathExpression(
  execution: Execution,
  expression: ExpressionStatement,
): LiteralValue {
  if (expression.path === '.' || expression.path === '$this') {
    return execution.context;
  }

  const path = expression.path.split('.');
  let contextDeepness = execution.contexts.length - 1;
  let ctx: any = execution.context;

  if (path[0] === '$this') {
    path.shift();
  } else if (path[0] === '$root') {
    ctx = execution.contexts[0];
    path.shift();
  } else if (path[0].startsWith('@')) {
    ctx = execution.getDataVar(path.shift()!.slice(1));
  } else
    while (path[0] === '$parent') {
      ctx = execution.contexts[--contextDeepness];
      path.shift();
    }

  for (const key of path) {
    const resolved = lookupOwnValue(ctx, key);
    if (typeof resolved === 'undefined') {
      return undefined;
    }

    ctx = resolved;
  }

  return ctx;
}
