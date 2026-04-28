import type { ExpressionStatement } from '../parser/statements.js';
import { UNSAFE_KEYS } from '../utils.js';
import type { Execution } from './execution.js';
import { helpers } from './helpers/index.js';
import { runStatement } from './index.js';
import type { LiteralValue } from './index.js';

async function runHelper(
  execution: Execution,
  expression: ExpressionStatement,
): Promise<LiteralValue> {
  const helperName = expression.path;
  if (UNSAFE_KEYS.has(helperName)) {
    throw new Error(`Helper ${helperName} not allowed`);
  }

  const fn =
    execution.extraHelpers.get(helperName) ??
    (execution.allowDefaultHelpers ? helpers[helperName] : undefined);
  if (!fn) {
    throw new Error(`Helper ${helperName} not found`);
  }

  const paramsTasks = expression.params.map(async (paramToUse) =>
    runStatement(execution, paramToUse),
  );
  const params = await Promise.all(paramsTasks);

  if (expression.hash) {
    const hashEntries = Object.entries(expression.hash);
    const hashValues = await Promise.all(
      hashEntries.map(async ([, v]) => runStatement(execution, v)),
    );
    const hashObj: Record<string, LiteralValue> = Object.create(null);
    for (const [idx, hashEntry] of hashEntries.entries()) {
      const key = hashEntry[0];
      if (UNSAFE_KEYS.has(key)) {
        throw new Error(`Hash key ${key} not allowed`);
      }

      hashObj[key] = hashValues[idx];
    }

    params.push(hashObj);
  }

  return await fn.apply(execution, params);
}

export async function runHelperExpression(
  execution: Execution,
  expression: ExpressionStatement,
): Promise<LiteralValue> {
  try {
    return await runHelper(execution, expression);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    if (expression.loc) {
      err.message = `Error at helper ${expression.path}, position ${expression.loc.start}: ${err.message}`;
    } else {
      err.message = `Error at helper ${expression.path}: ${err.message}`;
    }

    throw err;
  }
}
