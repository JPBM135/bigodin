import type { BlockStatement, ExpressionStatement } from '../parser/statements.js';
import type { Execution } from './execution.js';
import { runStatement, runStatements } from './index.js';

const isFalsy = (value: unknown): boolean => !value || (Array.isArray(value) && value.length === 0);

const isNativeWith = (execution: Execution, expression: ExpressionStatement): boolean =>
  expression.path === 'with' &&
  !execution.extraHelpers.has('with') &&
  execution.allowDefaultHelpers;

async function runWithBlock(
  execution: Execution,
  block: BlockStatement,
): Promise<string | null> {
  const params = block.expression.params;
  const values = await Promise.all(
    params.map(async (param) => runStatement(execution, param)),
  );

  const frames = values.filter((v) => !isFalsy(v));

  if (block.isNegated) {
    if (frames.length === 0) {
      return runStatements(execution, block.statements);
    }

    if (Array.isArray(block.elseStatements)) {
      return runStatements(execution, block.elseStatements);
    }

    return null;
  }

  if (frames.length === 0) {
    if (Array.isArray(block.elseStatements)) {
      return runStatements(execution, block.elseStatements);
    }

    return null;
  }

  for (const frame of frames) {
    execution.pushContext(frame as object);
  }

  const result = await runStatements(execution, block.statements);
  execution.popContexts(frames.length);

  return result;
}

export async function runBlock(
  execution: Execution,
  block: BlockStatement,
): Promise<string | null> {
  if (isNativeWith(execution, block.expression)) {
    return runWithBlock(execution, block);
  }

  const value = await runStatement(execution, block.expression);
  const falsy = isFalsy(value);

  // Negated blocks
  if (block.isNegated) {
    if (falsy) {
      return runStatements(execution, block.statements);
    }

    if (Array.isArray(block.elseStatements)) {
      return runStatements(execution, block.elseStatements);
    }

    return null;
  }

  // Falsy value or empty array
  if (falsy) {
    if (Array.isArray(block.elseStatements)) {
      return runStatements(execution, block.elseStatements);
    }

    return null;
  }

  // Non empty array
  if (Array.isArray(value)) {
    let result = '';

    for (let idx = 0; idx < value.length; idx++) {
      execution.pushContext(value[idx]);
      execution.pushDataFrame({
        index: idx,
        key: idx,
        first: idx === 0,
        last: idx === value.length - 1,
      });
      result += await runStatements(execution, block.statements);
      execution.popDataFrame();
      execution.popContext();
      if (execution.isHalted) {
        break;
      }
    }

    return result;
  }

  // Object
  if (typeof value === 'object' && value !== null) {
    execution.pushContext(value);
    const result = await runStatements(execution, block.statements);
    execution.popContext();
    return result;
  }

  // Truthy scalar - preserve Bigodin's existing behavior of NOT pushing the
  // scalar onto the context stack. Mustache spec tests that rely on the
  // push are listed in test/spec.spec.js SKIPPED_FEATURES.
  return runStatements(execution, block.statements);
}
