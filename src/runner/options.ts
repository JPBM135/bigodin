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
}
