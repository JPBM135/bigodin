/**
 * A loader for a {@link LazyValue}. May be synchronous or asynchronous; its
 * resolved return value is what a template path or helper observes in place of
 * the lazy marker.
 */
export type LazyLoader = () => Promise<unknown> | unknown;

/**
 * Handler invoked with the raw loader error when resolution fails. Return a
 * value to substitute it (stripped like any loader result) or re-throw to fail
 * the interpolation.
 */
export type LazyErrorHandler = (error: unknown) => Promise<unknown> | unknown;

/**
 * Options controlling how a {@link LazyValue} resolves.
 */
export interface LazyOptions {
  /**
   * When `true` (the default), the loader runs at most once per render and its
   * result - or its failure - is memoized. When `false`, the loader re-runs on
   * every reference.
   *
   * @type {boolean}
   */
  cache?: boolean;

  /**
   * Called with the raw loader error when resolution fails. Return a value to
   * substitute it, or re-throw to fail the interpolation. When omitted, the
   * error propagates and the render fails.
   *
   * @type {LazyErrorHandler}
   */
  onError?: LazyErrorHandler;
}

/**
 * Opt-in marker for a context value loaded on demand, the first time a template
 * path or helper actually reads it. Construct one with {@link lazy}.
 *
 * Templates cannot construct or forge a `LazyValue`, so only integrator-supplied
 * context can carry one - resolution is as trusted as an async helper.
 */
export class LazyValue {
  readonly #loader: LazyLoader;

  readonly #cache: boolean;

  readonly #onError?: LazyErrorHandler;

  #resolved?: Promise<unknown>;

  public constructor(loader: LazyLoader, options: LazyOptions = {}) {
    this.#loader = loader;
    this.#cache = options.cache ?? true;
    this.#onError = options.onError;
  }

  /**
   * Resolve the value. With caching on, the loader runs at most once per
   * instance and its result or failure is memoized; with caching off, the
   * loader runs on every call. A failure is routed through `onError` when one
   * was provided.
   *
   * @return {Promise<unknown>} The loaded value, or `onError`'s substitute.
   */
  public async resolve(): Promise<unknown> {
    // Wrap the loader in an async IIFE so a synchronous throw and a rejected
    // promise memoize identically - the loader fires at most once per render
    // even on failure.
    const run = async (): Promise<unknown> => {
      try {
        return await this.#loader();
      } catch (error) {
        if (this.#onError) {
          return this.#onError(error);
        }

        throw error;
      }
    };

    if (!this.#cache) {
      return run();
    }

    return (this.#resolved ??= run());
  }

  /**
   * A new instance sharing this one's loader and options but with an empty
   * cache. The context clone hands out a fresh instance per render so
   * memoization never leaks across renders.
   *
   * @return {LazyValue} A fresh, unresolved copy.
   */
  public fresh(): LazyValue {
    return new LazyValue(this.#loader, { cache: this.#cache, onError: this.#onError });
  }
}

/**
 * Creates a {@link LazyValue} for use in a render context. The loader runs the
 * first time a template path or helper reads the value.
 *
 * @param {LazyLoader} loader Function producing the value (sync or async).
 * @param {LazyOptions?} options Resolution options.
 * @return {LazyValue} The lazy marker to place in a context.
 */
export function lazy(loader: LazyLoader, options?: LazyOptions): LazyValue {
  return new LazyValue(loader, options);
}
