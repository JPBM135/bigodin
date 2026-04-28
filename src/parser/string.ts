import Pr from './pr.js';
import { char } from './utils.js';

/* v8 ignore start */
enum State {
  READ_CHAR,
  READ_ESCAPED_CHAR,
}
/* v8 ignore stop */

const escapes: Record<string, string> = {
  '"': '"',
  "'": "'",
  '`': '`',
  '\\': '\\',
  // eslint-disable-next-line id-length
  n: '\n',
  // eslint-disable-next-line id-length
  r: '\r',
  // eslint-disable-next-line id-length
  t: '\t',
};

const doubleQuote = Pr.string('"').withName('double quotes');
const singleQuote = Pr.string("'").withName('single quote');
const graveAccent = Pr.string('`').withName('grave accent');
const quote = Pr.oneOf(doubleQuote, singleQuote, graveAccent);

// eslint-disable-next-line func-names
export const lString = Pr.context('string', function* () {
  const openQuote = yield quote;
  let state: State = State.READ_CHAR;
  let content = '';

  /* v8 ignore start */
  while (true) {
    /* v8 ignore stop */
    switch (state) {
      case State.READ_CHAR: {
        const yieldedChar = yield char;
        if (yieldedChar === '\\') {
          state = State.READ_ESCAPED_CHAR;
          break;
        }

        if (yieldedChar === openQuote) {
          return content;
        }

        content += yieldedChar;
        break;
      }

      case State.READ_ESCAPED_CHAR: {
        const yieldedChar: string = yield char;
        content += escapes[yieldedChar] || yieldedChar;
        state = State.READ_CHAR;
        break;
      }

      /* v8 ignore start */
      default:
        yield Pr.fail(`Unexpected state ${state} at string parser`);
      /* v8 ignore stop */
    }
  }
});
