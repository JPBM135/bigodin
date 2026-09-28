/**
 * Well-known symbol that marks an object as an error, like `Symbol.iterator`
 * marks it as iterable. Set it to a truthy value on any object, own or
 * inherited, and return it from a helper. Tagged values are falsy for
 * built-in helpers and blocks, and render as an empty string.
 *
 * Registered through `Symbol.for` so the CJS and ESM builds share it.
 */
export const errorTag: unique symbol = Symbol.for('bigodin.error');

/**
 * Checks whether a value is tagged with {@link errorTag}.
 *
 * @param {unknown} value Value to check
 * @return {boolean} Whether the value is a tagged error
 */
export function isError(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    Boolean((value as { [errorTag]?: unknown })[errorTag])
  );
}
