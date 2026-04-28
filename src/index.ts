import { $expression } from './parser/expression.js';
import { $template } from './parser/index.js';
import type { TemplateStatement, ValueStatement } from './parser/statements.js';
import { Execution } from './runner/execution.js';
import type { Helper } from './runner/helpers/type.js';
import type { LiteralValue } from './runner/index.js';
import { run as _run, runStatement } from './runner/index.js';
import type { BigodinOptions } from './runner/options.js';
import { ensure } from './utils.js';

/**
 * @param {object?} context Context to be used when evaluating the template.
 * @param {BigodinOptions?} options Options to be used.
 * @return {Promise<string>} Promise that resolves to the rendered template.
 */
export type TemplateRunner = (context?: object, options?: BigodinOptions) => Promise<string>;

/**
 * Bigodin class, used if you need custom settings or helpers
 * not present in the default functions.
 */
class Bigodin {
  private readonly helpers: Map<string, Helper> = new Map();

  /**
   * Parses a template and returns an AST representing it.
   * This can be persisted as JSON for later usage.
   *
   * @param {string} template Bigodin template to be parsed
   * @return {TemplateStatement} AST representing input template
   */
  public parse = (template: string): TemplateStatement => {
    ensure(typeof template === 'string', 'Template must be a string');
    return $template.parse(template);
  };

  /**
   * Parses a bigodin expression into its AST representation.
   * This can be persisted as JSON for later usage.
   *
   * @param {string} expression Bigodin expression to be parsed
   * @return {ValueStatement} AST representing input expression
   */
  public parseExpression = (expression: string): ValueStatement => {
    ensure(typeof expression === 'string', 'Expression must be a string');
    return $expression.parse(expression);
  };

  /**
   * Runs an AST returned by the {@link Bigodin#parse} method.
   *
   * @param {TemplateStatement} ast AST returned by {@link Bigodin#parse}.
   * @param {object?} context Context to be used when evaluating the template.
   * @param {BigodinOptions?} options Options to be used.
   * @return {Promise<string>} Promise that resolves to the rendered template.
   */
  public run = async (
    ast: TemplateStatement,
    context?: object,
    options?: BigodinOptions,
  ): Promise<string> => _run(ast, context, this.helpers, options);

  /**
   * Runs an AST returned by the {@link Bigodin#parseExpression} method.
   *
   * @param {ValueStatement} statement AST returned by {@link Bigodin#parseExpression}.
   * @param {object?} context Context to be used when evaluating the expression.
   * @param {BigodinOptions?} options Options to be used.
   * @return {Promise<LiteralValue>} Promise that resolves to the rendered expression.
   */
  public runExpression = async (
    statement: ValueStatement,
    context?: object,
    options?: BigodinOptions,
  ): Promise<LiteralValue> => {
    const execution = Execution.of(context, this.helpers, options);
    return runStatement(execution, statement);
  };

  /**
   * Compiles a template and returns a function that, when called, executes it
   *
   * @param {string} template Bigodin template to be parsed
   * @return {TemplateRunner} Function that executes the template
   */
  public compile = (template: string): TemplateRunner => {
    const ast = this.parse(template);
    return async (context?: object, options?: BigodinOptions) => this.run(ast, context, options);
  };

  /**
   * Compiles an expression and returns a function that, when called, executes it
   *
   * @param {string} expression Bigodin expression to be parsed
   * @return {TemplateRunner} Function that executes the template
   */
  public compileExpression = (
    expression: string,
  ): ((context?: object, options?: BigodinOptions) => Promise<LiteralValue>) => {
    const ast = this.parseExpression(expression);
    return async (context?: object, options?: BigodinOptions) =>
      this.runExpression(ast, context, options);
  };

  /**
   * Adds a helper to the Bigodin instance.
   *
   * @param {string} name Name of the helper when used in templates
   * @param {Function} helper Function to be executed when helper is called
   * @return {Bigodin} Returns the Bigodin instance for chaining
   */
  public addHelper = (name: string, helper: Helper): this => {
    ensure(typeof name === 'string', 'name must be a string');
    ensure(typeof helper === 'function', 'helper must be a function');

    this.helpers.set(name, helper);
    return this;
  };
}

const defaultBigodin = new Bigodin();

/**
 * Parses a template and returns an AST representing it.
 * This can be persisted as JSON for later usage.
 *
 * @param {string} template Bigodin template to be parsed
 * @return {TemplateStatement} AST representing input template
 */
export const { parse, parseExpression } = defaultBigodin;

/**
 * Runs an AST returned by the {@link parse} method.
 *
 * @param {TemplateStatement} ast AST returned by {@link parse}.
 * @param {object?} context Context to be used when evaluating the template.
 * @param {BigodinOptions?} options Options to be used.
 * @return {Promise<string>} Promise that resolves to the rendered template.
 */
export const { run, runExpression } = defaultBigodin;

/**
 * Compiles a template and returns a function that, when called, executes it
 *
 * @param {string} template Bigodin template to be parsed
 * @return {TemplateRunner} Function that executes the template
 */
export const { compile, compileExpression } = defaultBigodin;

export type { TemplateStatement } from './parser/statements.js';
export type { BigodinOptions } from './runner/options.js';
export { Bigodin };
export default Bigodin;
