export interface BigodinOptions {
  /**
   * Indicates whether the execution allows default helpers. Default helpers are provided by bigodin.
   *
   * @type {boolean}
   */
  allowDefaultHelpers?: boolean;

  /**
   * Data that cannot be accessed from the template but can be accessed and modified from helpers
   *
   * @type {object}
   */
  data?: object;

  /**
   * Maximum milliseconds allowed for the template execution
   *
   * @type {number}
   */
  maxExecutionMillis?: number;

  /**
   * Maximum length, in characters, of the rendered output. The run rejects
   * once the template has emitted more than this. Unlimited by default.
   *
   * @type {number}
   */
  maxOutputLength?: number;

  /**
   * Maximum number of statements a run may execute. Every text, mustache,
   * block, sub-expression and loop iteration body counts. This bounds the
   * work of a template deterministically, independent of machine speed.
   * Unlimited by default.
   *
   * @type {number}
   */
  maxStatements?: number;
}
