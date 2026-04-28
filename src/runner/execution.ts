import { LiteralValue } from './index.js';
import { BigodinOptions } from './options.js';

/**
 * Template execution, holds contexts, extra helpers, data.
 */
export class Execution {
    /**
     * Indicates whether the execution has been halted by a flow control helper.
     */
    public isHalted = false;

    /**
     * Timestamp of the template execution start
     */
    private startMillis = Date.now();

    /**
     * Bigodin variables
     */
    public readonly variables: Record<string, LiteralValue> = {};

    /**
     * Per-iteration data frames populated by block iteration. Consumed by
     * path expressions resolving `@index`, `@key`, `@first`, `@last`.
     * Inner frames shadow outer frames (Handlebars uses `@../index` for
     * outer access, which bigodin does not support).
     */
    private readonly dataFrames: Record<string, unknown>[] = [];

    /**
     * Template execution, holds contexts, extra helpers, data.
     *
     * @param {object[]} contexts Contexts from which bigodin path expressions will evaluate
     * @param {Map<string, Function>} extraHelpers Extra helpers that can be called other than default bigodin helpers
     * @param {object?} data Data that cannot be accessed from the template but can be accessed and modified from helpers
     * @param {number} maxExecutionMillis Maximum milliseconds allowed for the template execution
     * @param {boolean} allowDefaultHelpers Indicates whether the execution allows default helpers. Default helpers are provided by bigodin.
     */
    private constructor(
        public readonly contexts: object[],
        public readonly extraHelpers: Map<string, Function>,
        public readonly data: object,
        public readonly maxExecutionMillis: number,
        public readonly allowDefaultHelpers: boolean,
    ) { }

    /**
     * Current context to be used by path expressions.
     *
     * @return {object} Current context to be used by path expressions.
     */
    get context(): object {
        return this.contexts[this.contexts.length - 1];
    }

    /**
     * Push a new context on the stack.
     * Used to change context allowing for $parent and $root access of previous contexts.
     */
    pushContext(context: object) {
        this.contexts.push(context);
    }

    /**
     * Pop the current context from the stack.
     */
    popContext() {
        this.contexts.pop();
    }

    /**
     * Push a data frame for the current iteration.
     */
    pushDataFrame(frame: Record<string, unknown>) {
        this.dataFrames.push(frame);
    }

    /**
     * Pop the current iteration's data frame.
     */
    popDataFrame() {
        this.dataFrames.pop();
    }

    /**
     * Resolve `@<name>` data variables (e.g., `index`, `key`, `first`, `last`).
     * Returns `undefined` outside of an iteration.
     */
    getDataVar(name: string): unknown {
        const top = this.dataFrames[this.dataFrames.length - 1];
        if (!top) {
            return undefined;
        }
        return Object.prototype.hasOwnProperty.call(top, name) ? top[name] : undefined;
    }

    /**
     * Halt the execution.
     */
    halt() {
        this.isHalted = true;
    }

    /**
     * Milliseconds since the template execution started.
     * @return {number} Milliseconds since the template execution started.
     */
    get elapsedMillis(): number {
        return Date.now() - this.startMillis;
    }

    /**
     * Creates an execution from context, helpers and options.
     *
     * @param {object} context Context from which bigodin path expressions will evaluate
     * @param {Map<string, Function>?} extraHelpers Extra helpers that can be called other than default bigodin helpers
     * @param {BigodinOptions} options Options for the current execution only
     * @return {Execution}
     */
    static of(context: object | undefined, extraHelpers: Map<string, Function> = new Map(), options: BigodinOptions = {}): Execution {
        return new Execution(
            [context ?? {}],
            extraHelpers,
            options.data ?? {},
            options.maxExecutionMillis || Infinity,
            options.allowDefaultHelpers ?? true,
        );
    }
}
