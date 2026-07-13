import { $expression } from './expression.js';
import type { Parser } from './pr.js';
import Pr from './pr.js';
import type {
  AssignmentStatement,
  BlockStatement,
  CommentStatement,
  ExpressionStatement,
  Location,
  MustacheStatement,
  Statement,
  TemplateStatement,
  TextStatement,
  Trim,
  ValueStatement,
} from './statements.js';
import { atPos, closeMustache, openMustache, optionalSpaces, peek, text, char } from './utils.js';
import { $assignment } from './variables.js';

const topOfStack = <T>(stack: T[]): T => stack[stack.length - 1];
const topOfStackStmts = (
  stack: (BlockStatement | Omit<TemplateStatement, 'loc'>)[],
): Statement[] => {
  const top = stack[stack.length - 1];
  if ('elseStatements' in top && top.elseStatements) {
    return top.elseStatements;
  }

  return top.statements;
};

const buildBlock = (
  loc: Location,
  expression: ExpressionStatement,
  isNegated: boolean,
  isNested = false,
): BlockStatement => {
  const block: BlockStatement = {
    type: 'BLOCK',
    loc,
    isNegated,
    expression,
    statements: [],
  };

  if (isNested) {
    block.isNested = isNested;
  }

  return block;
};

export const VERSION = 5;

// Mustache spec compatibility: standalone-line whitespace stripping.
// A "standalone tag" is one whose containing line has only the tag and
// surrounding whitespace; in that case the entire line (leading whitespace
// and trailing newline) is consumed. Variable interpolation tags
// ({{x}}, {{{x}}}, {{&x}}) are NOT standalone-eligible per spec.
const isWsOnly = (string: string): boolean => /^[\t ]*$/.test(string);

const tryStripStandalone = (
  prev: TextStatement | null,
  next: TextStatement | null,
  atTemplateStart: boolean,
  atTemplateEnd: boolean,
): void => {
  let prevCut = 0;
  if (prev) {
    const prevValue = prev.value;
    if (prevValue !== '') {
      // Non-empty prev. An empty prev was either originally empty or
      // already stripped by an adjacent standalone sibling - either way,
      // the current tag is at line start, so prevCut stays 0.
      const lastNL = prevValue.lastIndexOf('\n');
      const tail = lastNL === -1 ? prevValue : prevValue.slice(lastNL + 1);
      if (!isWsOnly(tail)) return;
      if (lastNL === -1 && !atTemplateStart) return;
      prevCut = lastNL === -1 ? 0 : lastNL + 1;
    }
  }

  let nextCut = 0;
  if (next) {
    const nextValue = next.value;
    const whitespaceLikeMatch = /^([\t ]*)(\r?\n)?/.exec(nextValue) as RegExpMatchArray;
    const wsLen = whitespaceLikeMatch[1].length;
    const nlLen = whitespaceLikeMatch[2] ? whitespaceLikeMatch[2].length : 0;
    if (nlLen === 0) {
      if (!atTemplateEnd) return;
      if (wsLen !== nextValue.length) return;
    }

    nextCut = wsLen + nlLen;
  }

  if (prev) prev.value = prev.value.slice(0, prevCut);
  if (next) next.value = next.value.slice(nextCut);
};

const asTextOrNull = (statement: Statement | undefined): TextStatement | null =>
  statement?.type === 'TEXT' ? statement : null;

const stripStandaloneLines = (
  stmts: Statement[],
  atTemplateStart: boolean,
  atTemplateEnd: boolean,
): void => {
  for (let idx = 0; idx < stmts.length; idx++) {
    const stmt = stmts[idx];
    const prev = asTextOrNull(stmts[idx - 1]);
    const next = asTextOrNull(stmts[idx + 1]);
    // A position "feels like" the template start if it's the first stmt
    // in this list AND this list is itself at the template start.
    const slotAtStart = atTemplateStart && (idx === 0 || (idx === 1 && prev !== null));
    const slotAtEnd =
      atTemplateEnd && (idx === stmts.length - 1 || (idx === stmts.length - 2 && next !== null));

    if (stmt.type === 'COMMENT' || stmt.type === 'ASSIGNMENT') {
      // Comments and assignments emit no output, so a tag alone on its line is
      // a standalone line and the whole line is removed. A side already consumed
      // by explicit `~` whitespace control is exempt (its whitespace is gone).
      const left = stmt.trim?.left ? null : prev;
      const right = stmt.trim?.right ? null : next;
      tryStripStandalone(left, right, slotAtStart, slotAtEnd);
    } else if (stmt.type === 'BLOCK') {
      const innerFirstText = asTextOrNull(stmt.statements[0]);
      const innerCloseList =
        stmt.elseStatements && stmt.elseStatements.length > 0
          ? stmt.elseStatements
          : stmt.statements;
      const innerLastText = asTextOrNull(innerCloseList[innerCloseList.length - 1]);

      const openPrev = stmt.trim?.open?.left ? null : prev;
      const openNext = stmt.trim?.open?.right ? null : innerFirstText;
      const closePrev = stmt.trim?.close?.left ? null : innerLastText;
      const closeNext = stmt.trim?.close?.right ? null : next;

      // Opener: prev = parent-list previous TEXT, next = first TEXT inside block
      tryStripStandalone(openPrev, openNext, slotAtStart, false);
      // Closer: prev = last TEXT inside block, next = parent-list next TEXT
      tryStripStandalone(closePrev, closeNext, false, slotAtEnd);
    }
  }

  for (const stmt of stmts) {
    if (stmt.type === 'BLOCK') {
      stripStandaloneLines(stmt.statements, false, false);
      if (stmt.elseStatements) {
        stripStandaloneLines(stmt.elseStatements, false, false);
      }
    }
  }
};

// Whitespace control (`~`). A `~` just inside a delimiter greedily removes all
// contiguous whitespace on that side. These run as a post-parse pass, before
// standalone-line stripping (which then skips `~`-handled sides).
const trimTextTail = (statement: TextStatement | null): void => {
  if (statement) statement.value = statement.value.replace(/\s+$/, '');
};

const trimTextHead = (statement: TextStatement | null): void => {
  if (statement) statement.value = statement.value.replace(/^\s+/, '');
};

const applyWhitespaceControl = (stmts: Statement[]): void => {
  for (let idx = 0; idx < stmts.length; idx++) {
    const stmt = stmts[idx];
    const prev = asTextOrNull(stmts[idx - 1]);
    const next = asTextOrNull(stmts[idx + 1]);

    if (stmt.type === 'MUSTACHE' || stmt.type === 'COMMENT' || stmt.type === 'ASSIGNMENT') {
      if (stmt.trim?.left) trimTextTail(prev);
      if (stmt.trim?.right) trimTextHead(next);
    } else if (stmt.type === 'BLOCK') {
      const innerFirst = asTextOrNull(stmt.statements[0]);
      const ifTail = asTextOrNull(stmt.statements[stmt.statements.length - 1]);
      const elseList = stmt.elseStatements;
      const closeList = elseList && elseList.length > 0 ? elseList : stmt.statements;
      const innerLast = asTextOrNull(closeList[closeList.length - 1]);

      if (stmt.trim?.open?.left) trimTextTail(prev);
      if (stmt.trim?.open?.right) trimTextHead(innerFirst);
      if (stmt.trim?.close?.left) trimTextTail(innerLast);
      if (stmt.trim?.close?.right) trimTextHead(next);
      if (stmt.trim?.else?.left) trimTextTail(ifTail);
      if (stmt.trim?.else?.right) trimTextHead(asTextOrNull(elseList?.[0]));
    }
  }

  for (const stmt of stmts) {
    if (stmt.type === 'BLOCK') {
      applyWhitespaceControl(stmt.statements);
      if (stmt.elseStatements) applyWhitespaceControl(stmt.elseStatements);
    }
  }
};

export const $text: Parser<Statement> = text
  .map((value, loc): TextStatement => ({ type: 'TEXT', loc, value }))
  .withName('text');

export const $comment: Parser<Statement> = Pr.all(char, text)
  .map(atPos(1))
  .map(
    (value, { start, end }): CommentStatement => ({
      type: 'COMMENT',
      loc: { start: start - 2, end: end + 2 },
      value,
    }),
  )
  .withName('comment');

const $mustache: Parser<Statement> = $expression.map((expression, { start, end }) => ({
  type: 'MUSTACHE',
  loc: { start: start - 2, end: end + 2 },
  expression,
}));

// Mustache spec compatibility: `{{#null}}` / `{{#true}}` / `{{#false}}` /
// `{{#undefined}}` look up the matching key in context rather than meaning
// the literal value (Bigodin's normal interpretation). Only applied as a
// block head; expression contexts still treat these names as literals.
const $literalKeyBlockHead: Parser<ExpressionStatement> = Pr.context(
  'literal-key-block-head',
  // eslint-disable-next-line func-names
  function* () {
    yield optionalSpaces;
    const name = yield Pr.regex('literal-key-block-head', /^(null|true|false|undefined)/);
    yield optionalSpaces;
    yield Pr.lookAhead(closeMustache);
    return name;
  },
).map(
  (name, loc): ExpressionStatement => ({
    type: 'EXPRESSION',
    loc,
    path: name,
    params: [],
  }),
);

// Optional `~` whitespace-control marker just inside a delimiter.
const tilde = Pr.optional(Pr.string('~'));

const $blockParamName = Pr.regex('block param name', /^[A-Z_a-z]\w*/);

// `as |a b|` block-params clause at the end of a block head. The head
// expression parser stops before `as |` (see expression.ts), leaving this
// clause for us to consume.
const $blockParams: Parser<string[]> = Pr.context(
  'block params',
  // eslint-disable-next-line func-names
  function* () {
    yield optionalSpaces;
    yield Pr.string('as');
    yield Pr.spaces();
    yield Pr.string('|');
    const names: string[] = [];
    /* v8 ignore start */
    while (true) {
      /* v8 ignore stop */
      yield optionalSpaces;
      const closing = yield Pr.optional(Pr.string('|'));
      if (closing) {
        break;
      }

      names.push(yield $blockParamName);
    }

    return names;
  },
);

const makeTrim = (left: boolean, right: boolean): Trim => {
  const trim: Trim = {};
  if (left) trim.left = true;
  if (right) trim.right = true;
  return trim;
};

const annotateStatement = (
  stmt: AssignmentStatement | CommentStatement | MustacheStatement,
  left: boolean,
  right: boolean,
): void => {
  if (left || right) stmt.trim = makeTrim(left, right);
};

const annotateBlock = (
  block: BlockStatement,
  slot: 'close' | 'else' | 'open',
  left: boolean,
  right: boolean,
): void => {
  if (!left && !right) return;
  block.trim ??= {};
  block.trim[slot] = makeTrim(left, right);
};

// eslint-disable-next-line func-names
export const $template = Pr.context('mustache', function* () {
  const stack: [Omit<TemplateStatement, 'loc'>, ...BlockStatement[]] = [
    {
      type: 'TEMPLATE',
      version: VERSION,
      statements: [],
    },
  ];

  /* v8 ignore start */
  while (true) {
    /* v8 ignore stop */
    const txt = yield Pr.optional($text);
    if (txt) {
      topOfStackStmts(stack).push(txt);
      // no need to `continue`, two texts in a row aren't possible
    }

    const open = yield Pr.optional(openMustache).map((v, loc) => (v ? loc : null));
    if (open) {
      const leftTrim = Boolean(yield tilde);
      // Set by each branch; invoked once the trailing `~` (rightTrim) is known.
      let annotate: ((left: boolean, right: boolean) => void) | null = null;

      switch (yield peek) {
        case '!': {
          const stmt = yield $comment;
          topOfStackStmts(stack).push(stmt);
          // The comment body parser greedily consumes up to `}}`, so a trailing
          // `~` lands inside the value; lift it out to a right-trim flag.
          let commentRight = false;
          if (stmt.value.endsWith('~')) {
            stmt.value = stmt.value.slice(0, -1);
            commentRight = true;
          }

          annotate = (left) => annotateStatement(stmt, left, commentRight);
          break;
        }

        case '=': {
          const stmt = yield $assignment;
          topOfStackStmts(stack).push(stmt);
          annotate = (left, right) => annotateStatement(stmt, left, right);
          break;
        }

        case '&': {
          yield char;
          const stmt = yield $mustache;
          topOfStackStmts(stack).push(stmt);
          annotate = (left, right) => annotateStatement(stmt, left, right);
          break;
        }

        case '{': {
          yield char;
          const stmt = yield $mustache;
          topOfStackStmts(stack).push(stmt);
          yield Pr.string('}');
          annotate = (left, right) => annotateStatement(stmt, left, right);
          break;
        }

        case '#':
        case '^': {
          const typeChar = yield char;
          const literalNamed = yield Pr.optional($literalKeyBlockHead);
          const expression: ValueStatement = literalNamed || (yield $expression);
          if (expression.type === 'LITERAL') {
            yield Pr.fail(
              `Blocks must receive path expressions or helpers. Literal blocks are not allowed.`,
            );
            // Never happens, just for typescript to know that below here, expression is not LiteralStatement
            /* v8 ignore start */
            return;
            /* v8 ignore stop */
          }

          if (expression.type === 'VARIABLE') {
            yield Pr.fail(
              `Variable blocks are not allowed, use '{{#if $var}}' for conditionals or '{{#each $var}}' for loops instead.`,
            );
            // Never happens, just for typescript to know that below here, expression is not VariableStatement
            /* v8 ignore start */
            return;
            /* v8 ignore stop */
          }

          const blockParams = yield Pr.optional($blockParams);
          const block = buildBlock(open, expression, typeChar === '^');
          if (blockParams) {
            block.blockParams = blockParams;
          }

          stack.push(block);
          annotate = (left, right) => annotateBlock(block, 'open', left, right);
          break;
        }

        case '/': {
          yield char; // Consuming '/'
          const literalNamed = yield Pr.optional($literalKeyBlockHead);
          const expression: ValueStatement = literalNamed || (yield $expression);
          if (expression.type === 'LITERAL') {
            yield Pr.fail(
              `Unexpected {{/${expression.value}}}. Literal blocks are not allowed to be closed.`,
            );
            // Never happens, just for typescript to know that below here, expression is not LiteralStatement
            /* v8 ignore start */
            return;
            /* v8 ignore stop */
          }

          if (expression.type === 'VARIABLE') {
            yield Pr.fail(`Unexpected {{/${expression.name}}}. Variable blocks are not allowed.`);
            // Never happens, just for typescript to know that below here, expression is not VariableStatement
            /* v8 ignore start */
            return;
            /* v8 ignore stop */
          }

          if (expression.params.length > 0) {
            yield Pr.fail(`Closing blocks cannot have parameters`);
          }

          const name = expression.path;
          if (stack.length <= 1) {
            yield Pr.fail(`Unexpected {{/${name}}}, this block wasn't opened`);
          }

          let block = stack.pop() as BlockStatement;

          // Nested blocks auto-close when parent is closed
          while (block.isNested) {
            block.loc.end = expression.loc.end + 2;
            topOfStackStmts(stack).push(block);
            block = stack.pop() as BlockStatement;
          }

          // Non nested blocks must close with same expression
          if (block.expression.path !== name) {
            yield Pr.fail(
              `Unexpected {{/${name}}}, this block was opened as {{#${block.expression.path}}}`,
            );
          }

          const closed = block;
          closed.loc.end = expression.loc.end + 2;
          topOfStackStmts(stack).push(closed);
          annotate = (left, right) => annotateBlock(closed, 'close', left, right);
          break;
        }

        default: {
          const isElseBlock = yield Pr.optional(
            Pr.all(
              optionalSpaces,
              Pr.string('else'),
              Pr.oneOf(
                Pr.string(' '),
                Pr.lookAhead(Pr.string('}}')),
                Pr.lookAhead(Pr.string('~}}')),
              ),
            ),
          );

          // Normal block
          if (!isElseBlock) {
            const stmt: MustacheStatement = yield $mustache;
            topOfStackStmts(stack).push(stmt);
            annotate = (left, right) => annotateStatement(stmt, left, right);
            break;
          }

          // Else outside blocks
          if (stack.length <= 1) {
            yield Pr.fail('{{else}} can only exist inside blocks');
          }

          const top = topOfStack(stack) as BlockStatement;

          // Multiple else blocks
          if (Array.isArray(top.elseStatements)) {
            yield Pr.fail(
              `an {{else}} block was already defined for the block ${top.expression.path}`,
            );
          }

          const stmt: MustacheStatement = yield Pr.optional($mustache);

          // Simple else block (no nesting)
          if (!stmt) {
            // eslint-disable-next-line require-atomic-updates -- single-threaded generator; `top` is stable
            top.elseStatements = [];
            annotate = (left, right) => annotateBlock(top, 'else', left, right);
            break;
          }

          // Else followed by literal
          if (stmt.expression.type === 'LITERAL') {
            yield Pr.fail('{{else}} blocks cannot have parameters');
            // Never happens, just for typescript to know that below here, expression is not LiteralStatement
            /* v8 ignore start */
            break;
            /* v8 ignore stop */
          }

          // Else followed by variable
          if (stmt.expression.type === 'VARIABLE') {
            yield Pr.fail(
              '{{else}} blocks cannot have variable parameters. Use "{{else if $var}}" instead.',
            );
            // Never happens, just for typescript to know that below here, expression is not VariableStatement
            /* v8 ignore start */
            break;
            /* v8 ignore stop */
          }

          // Nested block ({{else if ...}}): left-trim belongs to the parent's
          // if-branch tail, right-trim to the nested block's body head.
          // eslint-disable-next-line require-atomic-updates -- single-threaded generator; `top` is stable
          top.elseStatements = [];
          const nested = buildBlock(open, stmt.expression, false, true);
          stack.push(nested);
          annotate = (left, right) => {
            annotateBlock(top, 'else', left, false);
            annotateBlock(nested, 'open', false, right);
          };

          break;
        }
      }

      yield optionalSpaces;
      const rightTrim = Boolean(yield tilde);
      yield closeMustache;
      annotate?.(leftTrim, rightTrim);
      continue;
    }

    const end = yield Pr.optional(Pr.end());
    if (end) {
      break;
    }

    yield Pr.fail('Unexpected end of file');
  }

  if (stack.length > 1) {
    const block = topOfStack(stack) as BlockStatement;
    yield Pr.fail(`Expected {{/${block.expression.path}}}, make sure this block was closed`);
  }

  applyWhitespaceControl(stack[0].statements);
  stripStandaloneLines(stack[0].statements, true, true);
  return stack[0];
}).map(
  (stmt, loc): TemplateStatement => ({
    ...(stmt as Omit<TemplateStatement, 'loc'>),
    loc,
  }),
);
