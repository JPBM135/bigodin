import { LiteralValue, runStatement } from './index.js';
import { ExpressionStatement } from '../parser/statements.js';
import { helpers } from './helpers/index.js';
import { UNSAFE_KEYS } from '../utils.js';
import { Execution } from './execution.js';

async function runHelper(execution: Execution, expression: ExpressionStatement): Promise<LiteralValue> {
    const helperName = expression.path;
    if (UNSAFE_KEYS.has(helperName)) {
        throw new Error(`Helper ${helperName} not allowed`);
    }

    const fn = execution.extraHelpers.get(helperName) || (execution.allowDefaultHelpers ? helpers[helperName] : undefined);
    if (!fn) {
        throw new Error(`Helper ${helperName} not found`);
    }

    const paramsTasks = expression.params.map(p => runStatement(execution, p));
    const params = await Promise.all(paramsTasks);
    const result = await fn.apply(execution, params);
    return result;
}

export async function runHelperExpression(execution: Execution, expression: ExpressionStatement): Promise<LiteralValue> {
    try {
        return await runHelper(execution, expression);
    } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (expression.loc) {
            err.message = `Error at helper ${expression.path}, position ${expression.loc.start}: ${err.message}`;
        } else {
            err.message = `Error at helper ${expression.path}: ${err.message}`;
        }
        throw err;
    }
}
