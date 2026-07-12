import type { ExpressionStatement } from '../parser/statements.js';
import { lookupOwnValue, resolveLazy } from '../utils.js';
import type { Execution } from './execution.js';
import type { LiteralValue } from './index.js';

export async function runPathExpression(
  execution: Execution,
  expression: ExpressionStatement,
): Promise<LiteralValue> {
  // Resolving a lazy value is the only fallible step here. Wrap a failing
  // loader (or its re-throwing onError) with the path and position, mirroring
  // the way helper errors are rewritten.
  const resolve = async (value: unknown): Promise<unknown> => {
    try {
      return await resolveLazy(value);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (expression.loc) {
        err.message = `Error resolving lazy value at "${expression.path}", position ${expression.loc.start}: ${err.message}`;
      } else {
        err.message = `Error resolving lazy value at "${expression.path}": ${err.message}`;
      }

      throw err;
    }
  };

  if (expression.path === '.' || expression.path === '$this') {
    return (await resolve(execution.context)) as LiteralValue;
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
  } else if (path[0] === '$parent') {
    while (path[0] === '$parent') {
      ctx = execution.contexts[--contextDeepness];
      path.shift();
    }
  } else {
    // A plain leading identifier may be a block param (`as |name|`), which
    // shadows the surrounding context. The prefixed namespaces above are not
    // shadowable; a param bound to `undefined` still shadows (found === true).
    const param = execution.getParam(path[0]);
    if (param.found) {
      ctx = param.value;
      path.shift();
    }
  }

  // The leading context may itself be lazy (a lazy array element bound as a
  // block param, a lazy whole-context, etc.), so resolve it before traversing.
  ctx = await resolve(ctx);

  for (const key of path) {
    const resolved = await resolve(lookupOwnValue(ctx, key));
    if (typeof resolved === 'undefined') {
      return undefined;
    }

    ctx = resolved;
  }

  return ctx;
}
