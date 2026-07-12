# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Bigodin is a Handlebars/Mustache-style templating library focused on safely evaluating user-provided templates. Templates are parsed into a JSON AST and interpreted at runtime - they are never compiled to JavaScript. Helpers can be async. Published to npm as `@jpbm135/bigodin`.

User-facing docs live in a Docusaurus site under `website/docs/`: `reference/lib.md` (API), `reference/language/` (template syntax), `reference/helpers.md` (built-in helpers), plus `how-to/`, `tutorial/`, and `explanation/` guides. The repo root has `README.md` and `CONTRIBUTING.md` only - there are no root `LIB.md`/`LANGUAGE.md`/`HELPERS.md` files (though `package.json#files` still lists them, which is a stale packaging entry).

## Common commands

The package declares `packageManager: yarn@4.14.1` and ships `.yarn/`, `.yarnrc.yml`, `yarn.lock` - use Yarn locally. CI runs the same yarn scripts.

- `yarn build` - compiles `src/` to both CommonJS (`dist/`, `tsconfig.cjs.json`) and ESM (`dist/esm/`, `tsconfig.esm.json`) via `tsc`, then runs `scripts/postbuild-esm.js`; `prebuild` clears `dist/` first.
- `yarn test` - runs Vitest (`vitest run`) over `test/**/*.spec.ts`. Tests import directly from `src/` (no build step), so source changes are picked up immediately - there is no stale-`dist/` trap.
- `yarn test:cov` - `vitest run --coverage` (v8 provider); writes `coverage/` and enforces 100% on every metric (`thresholds: { 100: true }` in `vitest.config.ts`). This is a CI gate; keep coverage at 100%.
- Run a single test file: `yarn test test/parser/parser.spec.ts` (append `-t "<pattern>"` to filter by test name).
- `yarn typecheck:test` - type-checks `src/` + `test/` with no emit (`tsconfig.test.json`).
- `yarn lint` / `yarn lint:fix` - ESLint (flat config in `eslint.config.mjs`) plus Prettier, over `src/**/*.ts` and `test/**/*.ts`.

Node ≥ 20 is required.

## Architecture

The library is split into two phases that can run in different processes; the AST in between is plain JSON.

### Parser (`src/parser/`)

Built on top of `pierrejs` parser combinators. Entry point `$template` (`src/parser/index.ts`) tokenizes a template into a `TemplateStatement` AST. Statement shapes (TEXT, COMMENT, MUSTACHE, EXPRESSION, BLOCK, LITERAL, VARIABLE, ASSIGNMENT, TEMPLATE) are defined in `src/parser/statements.ts`.

The parser emits a `version` on the root template (`VERSION` constant in `src/parser/index.ts`). The runner enforces `MIN_VERSION`/`MAX_VERSION` (`src/runner/index.ts`) - when changing AST shape, bump `VERSION` and update the supported range so old persisted ASTs fail loudly with "parse it again". Don't widen the range silently.

Block parsing uses an explicit stack with a notion of "nested" blocks for `{{else if}}` chains, which auto-close when their parent closes. Path/literal/variable expressions live in `expression.ts`, `literal.ts`, `variables.ts` respectively.

### Runner (`src/runner/`)

`run(ast, context, extraHelpers, options)` interprets the AST. Per-execution state lives in `Execution` (`src/runner/execution.ts`):

- `contexts` is a stack pushed/popped by blocks so `$parent`/`$root`/`$this` work.
- `variables` backs `{{= $var ...}}` assignments.
- `data` is helper-only side-channel state (templates can't read it; helpers mutate it via `this.data`).
- `maxExecutionMillis` is checked at the top of every `runStatement` - flow-control helpers can also `halt()` execution, which short-circuits `runStatements`.
- `allowDefaultHelpers` (default true) toggles the bundled helpers off; extra helpers added via `addHelper` always run.

Statement dispatch is the `switch` in `runStatement`. Adding a new statement type means: define it in `parser/statements.ts`, parse it, add a `case` here, and rely on the trailing `statement satisfies never` to surface missed branches at compile time.

Helper resolution (`src/runner/helper.ts`): user-registered helpers in `execution.extraHelpers` win over built-ins. `UNSAFE_KEYS` (from `src/utils.ts`) blocks prototype-pollution-style helper names like `__proto__` - keep that check whenever touching helper lookup. Helper params are evaluated in parallel via `Promise.all`; helpers receive `Execution` as `this`.

Bare-identifier expressions (no params) are ambiguous between path access and a no-arg helper call. The disambiguation in `runExpression` is: if a helper exists with that name (extra or default), call it; otherwise treat it as a path. This means registering a helper can shadow a context key with the same name.

Lazy context values (`src/lazy.ts`): a `LazyValue` - created via the exported `lazy(loader, { cache, onError })` factory - is an opt-in marker an integrator places in the context to defer a load until a path or helper actually reads it. Resolution is centralized in `runPathExpression` (`src/runner/path-expression.ts`): it resolves the leading context, every path hop, and the `{{.}}`/`{{$this}}` early return, so `with`/`each` blocks get it for free without touching `block.ts`. `cloneValue` (`src/utils.ts`) hands out a `fresh()` instance per render - tracked, so two references to the same instance load once - and the shared `resolveLazy` re-strips a resolved object through `deepCloneNullPrototype` for parity with eager context. `src/lazy.ts` stays dependency-free so `utils.ts` can import it without a cycle. Helpers force a held lazy via `this.resolveLazy(value)`. The AST is unchanged, so the feature needed no `VERSION` bump.

### Built-in helpers (`src/runner/helpers/`)

Grouped by category (`array`, `code`, `comparison`, `date`, `math`, `string`) and merged in `helpers/index.ts` into a null-prototype object. When adding a helper, put it in the matching file, export through that group, and add tests under `test/helpers/<group>.spec.ts`. New helpers must also be documented in `website/docs/reference/helpers.md` - that file is the public contract.

A few helpers (`sort`, `splice`) are explicitly written to not mutate their input arrays; preserve that invariant when editing them (see commits `c91f910`, `d12b04c`).

### Public API surface (`src/index.ts`)

Exports a `Bigodin` class plus pre-bound `parse`, `parseExpression`, `run`, `runExpression`, `compile`, `compileExpression` from a default singleton. The module-level convenience exports do **not** carry user helpers - `addHelper` only affects the instance it's called on, so users wanting custom helpers must `new Bigodin()`.

## Tests

Vitest (`describe`/`it`/`expect` imported from `vitest`). Tests are TypeScript (`test/**/*.spec.ts`) and import directly from `src/` - no build step, no `dist/`. Coverage threshold is 100% on all metrics; use `/* v8 ignore start */ … /* v8 ignore stop */` only for genuinely unreachable branches (TypeScript exhaustiveness guards), as already done in the parser/runner.

`test/security.spec.ts` covers prototype pollution, sandbox escapes, and execution-time limits - touch helper resolution, `Execution`, `deepCloneNullPrototype`, or lazy-value resolution carefully and re-run that file.

## Conventions

- 2-space indent, single quotes, trailing commas, `'as-needed'` arrow parens - enforced by `eslint.config.mjs` + Prettier.
- Source is TypeScript targeting `es2022`, built to both CommonJS (`dist/`) and ESM (`dist/esm/`); declarations are emitted to `dist/`. Relative imports use explicit `.js` extensions (the ESM build resolves with `nodenext`). Don't import from `dist/` inside `src/`.
- Don't introduce runtime dependencies casually - currently only `pierrejs`. The library's value prop is "safe to run on user input", so new deps are scrutinized.
