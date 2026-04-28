import Pr, { Parser } from './pr.js';
import { $literal } from './literal.js';
import { ExpressionStatement, Location, Statement, ValueStatement } from './statements.js';
import { optionalSpaces } from './utils.js';
import { $variable } from './variables.js';
import { ensure } from '../utils.js';

/* v8 ignore start */
enum State {
    _START,
    GOT_LITERAL,
    GOT_PATH,
}
/* v8 ignore stop */

type Frame = {
    items: ValueStatement[];
    hash: Record<string, ValueStatement>;
    pendingHashKey: string | null;
    pendingHashKeyLoc: Location | null;
    hashOnly: boolean;
};

const newFrame = (): Frame => ({
    items: [],
    hash: Object.create(null),
    pendingHashKey: null,
    pendingHashKeyLoc: null,
    hashOnly: false,
});

const topOfStack = <T>(stack: T[]): T => stack[stack.length - 1];

const peekEnd = Pr.lookAhead(Pr.string('}}'));

// Handlebars path aliases: rewrite `../`, `@root`, and bare `this` into the
// existing `$parent`/`$root`/`$this` AST representation. Other `@<name>`
// segments (`@index`, `@key`, `@first`, `@last`) are preserved and resolved
// at runtime by `runPathExpression`.
const normalizePath = (raw: string): string => {
    let s = raw;
    let parents = 0;
    while (s.startsWith('../')) {
        parents++;
        s = s.slice(3);
    }

    if (s === '@root') {
        s = '$root';
    } else if (s.startsWith('@root.')) {
        s = '$root' + s.slice(5);
    } else if (s === 'this') {
        s = '$this';
    } else if (s.startsWith('this.')) {
        s = '$this' + s.slice(4);
    }

    if (parents === 0) {
        return s;
    }
    const parentChain = Array(parents).fill('$parent').join('.');
    // The path regex requires at least one head char after `../`, so `s`
    // is always non-empty when parents > 0.
    return `${parentChain}.${s}`;
};

export const path: Parser<ExpressionStatement> = Pr.regex(
    'context path',
    /^(?:\.\.\/)*(?:@[a-zA-Z0-9_]+|[a-zA-Z0-9\-_$\.])[a-zA-Z0-9\-_$\.]*/,
).map((raw, loc) => ({
    type: 'EXPRESSION' as const,
    loc,
    path: normalizePath(raw),
    params: [],
}));

const $hashKey: Parser<string> = Pr.context('hash key', function* () {
    const key = yield Pr.regex('hash key', /^[a-zA-Z_][a-zA-Z0-9_]*(?==)/);
    yield Pr.string('=');
    return key;
});

const pushIntoFrame = (frame: Frame, value: ValueStatement): string | null => {
    if (frame.pendingHashKey !== null) {
        const key = frame.pendingHashKey;
        // Duplicate keys are caught earlier by the hash-key parser before
        // pendingHashKey is set; this guard is defensive.
        /* v8 ignore start */
        if (key in frame.hash) {
            return `Duplicate hash key '${key}'`;
        }
        /* v8 ignore stop */
        frame.hash[key] = value;
        frame.pendingHashKey = null;
        frame.pendingHashKeyLoc = null;
        frame.hashOnly = true;
        return null;
    }
    if (frame.hashOnly) {
        return 'Positional parameters cannot follow hash arguments';
    }
    frame.items.push(value);
    return null;
};

const expressionFromFrame = (frame: Frame): ValueStatement => {
    ensure(frame.items.length > 0, '[internal bigodin error] expressionFromFrame received an empty frame');
    const [stmt, ...params] = frame.items;
    const hashKeys = Object.keys(frame.hash);

    if (stmt.type !== 'EXPRESSION') {
        ensure(
            params.length === 0 && hashKeys.length === 0,
            '[internal bigodin error] expressionFromFrame received a non-expression with parameters',
        );
        return stmt;
    }

    if (params.length === 0 && hashKeys.length === 0) {
        return stmt;
    }

    ensure(
        stmt.params.length === 0,
        '[internal bigodin error] expressionFromFrame received an expression with parsed and unparsed parameters',
    );
    stmt.params = params;
    if (hashKeys.length > 0) {
        stmt.hash = frame.hash;
    }
    return stmt;
};

export const $expression: Parser<ValueStatement> = Pr.context('expression', function* () {
    const stack: Frame[] = [newFrame()];
    let state: State = State._START;

    /* v8 ignore start */
    while (true) {
    /* v8 ignore stop */
        switch (state) {
            case State._START: {
                yield optionalSpaces;

                const l = yield Pr.optional($literal);
                if (l) {
                    topOfStack(stack).items.push(l);
                    state = State.GOT_LITERAL;
                    break;
                }

                const v = yield Pr.optional($variable);
                if (v) {
                    topOfStack(stack).items.push(v);
                    state = State.GOT_LITERAL; // Variables behave like literals in terms of parsing
                    break;
                }

                const p = yield Pr.optional(path);
                if (p) {
                    topOfStack(stack).items.push(p);
                    state = State.GOT_PATH;
                    break;
                }

                const subExpr = yield Pr.optional(Pr.string('('));
                if (subExpr) {
                    stack.push(newFrame());
                    state = State._START;
                    break;
                }

                yield Pr.fail('Expected literal, helper or context path');
            }

            case State.GOT_LITERAL: {
                yield optionalSpaces;

                const end = yield Pr.optional(Pr.oneOf<string|true>(peekEnd, Pr.end()));
                if (end) {
                    if (stack.length > 1) {
                        yield Pr.fail('Expected ")", make sure every parenthesis was closed');
                    }
                    return expressionFromFrame(stack[0]);
                }

                const subExprEnd: Location = yield Pr.optional(Pr.string(')')).map((v, loc) => v ? loc : null);
                if (subExprEnd) {
                    if (stack.length <= 1) {
                        yield Pr.fail('Unexpected ")", this parenthesis wasn\'t opened');
                    }

                    const popped = stack.pop()!;
                    const value = expressionFromFrame(popped);
                    const err = pushIntoFrame(topOfStack(stack), value);
                    /* v8 ignore start */
                    if (err) {
                        yield Pr.fail(err);
                    }
                    /* v8 ignore stop */
                    state = State.GOT_PATH;
                    break;
                }

                yield Pr.fail('Expected "}}". Literal mustaches cannot have parameters.');
            }

            case State.GOT_PATH: {
                yield optionalSpaces;
                const frame = topOfStack(stack);

                const end = yield Pr.optional(Pr.oneOf<string|true>(peekEnd, Pr.end()));
                if (end) {
                    if (frame.pendingHashKey !== null) {
                        yield Pr.fail(`Hash argument '${frame.pendingHashKey}' is missing a value`);
                    }
                    if (stack.length > 1) {
                        yield Pr.fail('Expected ")", make sure every parenthesis was closed');
                    }
                    return expressionFromFrame(stack[0]);
                }

                if (frame.pendingHashKey === null) {
                    const hashKey = yield Pr.optional($hashKey).map((v, loc) => v ? { name: v as string, loc } : null);
                    if (hashKey) {
                        if (hashKey.name in frame.hash) {
                            yield Pr.fail(`Duplicate hash key '${hashKey.name}'`);
                        }
                        frame.pendingHashKey = hashKey.name;
                        frame.pendingHashKeyLoc = hashKey.loc;
                        break;
                    }
                }

                const param = yield Pr.optional(Pr.either<Statement>($literal, $variable, path));
                if (param) {
                    const err = pushIntoFrame(frame, param as ValueStatement);
                    if (err) {
                        yield Pr.fail(err);
                    }
                    state = State.GOT_PATH;
                    break;
                }

                const subExpr = yield Pr.optional(Pr.string('('));
                if (subExpr) {
                    stack.push(newFrame());
                    state = State._START;
                    break;
                }

                const subExprEnd: Location = yield Pr.optional(Pr.string(')')).map((v, loc) => v ? loc : null);
                if (subExprEnd) {
                    if (frame.pendingHashKey !== null) {
                        yield Pr.fail(`Hash argument '${frame.pendingHashKey}' is missing a value`);
                    }
                    if (stack.length <= 1) {
                        yield Pr.fail('Unexpected ")", this parenthesis wasn\'t opened');
                    }

                    const popped = stack.pop()!;
                    const processed = expressionFromFrame(popped);
                    processed.loc.end = subExprEnd.start;
                    const err = pushIntoFrame(topOfStack(stack), processed);
                    if (err) {
                        yield Pr.fail(err);
                    }
                    state = State.GOT_PATH;
                    break;
                }

                yield Pr.fail('Expected expression parameters or "}}"');
            }

            /* v8 ignore start */
            default:
                yield Pr.fail(`Unexpected state ${state} at expression parser`);
            /* v8 ignore stop */
        }
    }
}).map((stmt, loc) => ({ ...stmt, loc }) as ValueStatement);
