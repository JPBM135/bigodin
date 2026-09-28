// Module-private symbols: templates only resolve string keys, so they can
// neither read nor forge the tag.
const ERROR_TAG = Symbol('bigodin.error');
const ERROR_VALUE = Symbol('bigodin.error.value');

export interface BigodinError {
  readonly [ERROR_TAG]: true;
  readonly [ERROR_VALUE]: unknown;
}

/**
 * Tags a helper return as an error. Tagged values are falsy for built-in
 * helpers and blocks, and render as an empty string.
 *
 * @param {unknown?} value Original value (an Error, a message, anything)
 * @return {BigodinError} Tagged error wrapper
 */
export function markError(value?: unknown): BigodinError {
  return Object.freeze(
    Object.assign(Object.create(null), { [ERROR_TAG]: true, [ERROR_VALUE]: value }),
  );
}

/**
 * Checks whether a value was tagged with {@link markError}.
 *
 * @param {unknown} value Value to check
 * @return {boolean} Whether the value is a tagged error
 */
export function isError(value: unknown): value is BigodinError {
  return typeof value === 'object' && value !== null && Object.hasOwn(value, ERROR_TAG);
}

/**
 * Returns the original value passed to {@link markError}.
 *
 * @param {BigodinError} value Tagged error wrapper
 * @return {unknown} Original value
 */
export function unwrapError(value: BigodinError): unknown {
  return value[ERROR_VALUE];
}
