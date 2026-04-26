import Pr from 'pierrejs';
import { char } from './utils';

/* v8 ignore start */
enum State {
    READ_CHAR,
    READ_ESCAPED_CHAR,
}
/* v8 ignore stop */

const escapes = {
    '"': '"',
    '\'': '\'',
    '`': '`',
    '\\': '\\',
    'n': '\n',
    'r': '\r',
    't': '\t',
};

const doubleQuote = Pr.string('"').withName('double quotes');
const singleQuote = Pr.string('\'').withName('single quote');
const graveAccent = Pr.string('`').withName('grave accent');
const quote = Pr.oneOf(doubleQuote, singleQuote, graveAccent);

export const lString = Pr.context('string', function* () {
    const openQuote = yield quote;
    let state: State = State.READ_CHAR;
    let content = '';

    /* v8 ignore start */
    while (true) {
    /* v8 ignore stop */
        switch (state) {
            case State.READ_CHAR: {
                const c = yield char;
                if (c === '\\') {
                    state = State.READ_ESCAPED_CHAR;
                    break;
                }

                if (c === openQuote) {
                    return content;
                }

                content += c;
                break;
            }

            case State.READ_ESCAPED_CHAR: {
                const c: string = yield char;
                content += escapes[c] || c;
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
