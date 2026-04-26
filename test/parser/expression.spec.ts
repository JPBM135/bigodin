import { describe, it, expect } from 'vitest';

import { $expression } from '../../src/parser/expression';

const parse = (code: string) => $expression.parse(code + '}}');

describe('parser', () => {
    describe('expression', () => {

        it('should parse literals', () => {
            expect(parse('true')).toEqual({
                type: 'LITERAL',
                loc: { start: 0, end: 4 },
                value: true,
            });
            expect(parse('42')).toEqual({
                type: 'LITERAL',
                loc: { start: 0, end: 2 },
                value: 42,
            });
            expect(parse('"foo"')).toEqual({
                type: 'LITERAL',
                loc: { start: 0, end: 5 },
                value: 'foo',
            });
        });

        it('should parse path parameters', () => {
            expect(parse('foo')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 3 },
                path: 'foo',
                params: [],
            });
            expect(parse('foo.bar')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 7 },
                path: 'foo.bar',
                params: [],
            });
            expect(parse('foo.a-b')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 7 },
                path: 'foo.a-b',
                params: [],
            });
        });

        it('should parse helpers', () => {
            expect(parse('foo "bar"')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 9 },
                path: 'foo',
                params: [{
                    type: 'LITERAL',
                    loc: { start: 4, end: 9 },
                    value: 'bar',
                }],
            });
            expect(parse('foo bar')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 7 },
                path: 'foo',
                params: [{
                    type: 'EXPRESSION',
                    loc: { start: 4, end: 7 },
                    path: 'bar',
                    params: [],
                }],
            });
            expect(parse('foo bar baz')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 11 },
                path: 'foo',
                params: [{
                    type: 'EXPRESSION',
                    loc: { start: 4, end: 7 },
                    path: 'bar',
                    params: [],
                }, {
                    type: 'EXPRESSION',
                    loc: { start: 8, end: 11 },
                    path: 'baz',
                    params: [],
                }],
            });
            expect(parse('foo bar "baz"')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 13 },
                path: 'foo',
                params: [{
                    type: 'EXPRESSION',
                    loc: { start: 4, end: 7 },
                    path: 'bar',
                    params: [],
                }, {
                    type: 'LITERAL',
                    loc: { start: 8, end: 13 },
                    value: 'baz',
                }],
            });
        });

        it('should parse parenthised arguments', () => {
            expect(parse('foo ("bar") (5)')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 15 },
                path: 'foo',
                params: [{
                    type: 'LITERAL',
                    loc: { start: 5, end: 10 },
                    value: 'bar',
                }, {
                    type: 'LITERAL',
                    loc: { start: 13, end: 14 },
                    value: 5,
                }],
            });

            expect(parse('foo (bar)')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 9 },
                path: 'foo',
                params: [{
                    type: 'EXPRESSION',
                    loc: { start: 5, end: 8 },
                    path: 'bar',
                    params: [],
                }],
            });
        });

        it('should parse nested expressions', () => {
            expect(parse('foo (bar "5") true')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 18 },
                path: 'foo',
                params: [{
                    type: 'EXPRESSION',
                    loc: { start: 5, end: 12 },
                    path: 'bar',
                    params: [{
                        type: 'LITERAL',
                        loc: { start: 9, end: 12 },
                        value: '5',
                    }],
                }, {
                    type: 'LITERAL',
                    loc: { start: 14, end: 18 },
                    value: true,
                }],
            });
            expect(parse('foo (bar "5" (baz "yada" 7)) true')).toEqual({
                type: 'EXPRESSION',
                loc: { start: 0, end: 33 },
                path: 'foo',
                params: [{
                    type: 'EXPRESSION',
                    loc: { start: 5, end: 27 },
                    path: 'bar',
                    params: [{
                        type: 'LITERAL',
                        loc: { start: 9, end: 12 },
                        value: '5',
                    }, {
                        type: 'EXPRESSION',
                        loc: { start: 14, end: 26 },
                        path: 'baz',
                        params: [{
                            type: 'LITERAL',
                            loc: { start: 18, end: 24 },
                            value: 'yada',
                        }, {
                            type: 'LITERAL',
                            loc: { start: 25, end: 26 },
                            value: 7,
                        }],
                    }],
                }, {
                    type: 'LITERAL',
                    loc: { start: 29, end: 33 },
                    value: true,
                }],
            });
        });

        it('should not close mustache inside string literal', () => {
            expect(parse('"foo }}"')).toEqual({
                type: 'LITERAL',
                loc: { start: 0, end: 8 },
                value: 'foo }}',
            });
        });

        it('should give friendly errors', () => {
            expect(() => parse('"foo" 5')).toThrow(/literal mustaches cannot have parameters/i);
            expect(() => parse('foo bar)')).toThrow(/this parenthesis wasn't opened/i);
            expect(() => parse('true)')).toThrow(/this parenthesis wasn't opened/i);
            expect(() => parse('foo (bar')).toThrow(/make sure every parenthesis was closed/i);
            expect(() => parse('foo (true')).toThrow(/make sure every parenthesis was closed/i);
            expect(() => parse('foo ()')).toThrow(/expected literal, helper or context path/i);
            expect(() => parse('foo !')).toThrow(/expected expression parameters or "}}"/i);
        });
    });
});
