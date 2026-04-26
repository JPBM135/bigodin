import { describe, it, expect } from 'vitest';

import { deepCloneNullPrototype, ensure } from '../src/utils';

describe('utils', () => {
    describe('deep clone', () => {
        it('should clone an object', () => {
            const obj = {
                a: 5,
                b: { c: { d: 7 } },
            };
            const clone = deepCloneNullPrototype(obj) as any;
            expect(clone).toEqual(obj);

            clone.b.c.d = 8;
            expect(obj.b.c.d).toEqual(7);
        });

        it('should clone arrays', () => {
            const obj = {
                a: [1, {
                    b: { c: 7 },
                }, 3],
            };
            const clone = deepCloneNullPrototype(obj) as any;
            expect(clone).toEqual(obj);

            clone.a[1].b.c = 8;
            expect((obj.a[1] as any).b.c).toEqual(7);
        });

        it('should ignore unsafe keys', () => {
            const obj = {
                __proto__: 5,
                constructor: 5,
            };
            const clone = deepCloneNullPrototype(obj) as any;

            expect(clone.__proto__).toBeUndefined();
            expect(clone.constructor).toBeUndefined();
        });

        it('should ignore inherited enumerable keys', () => {
            const parent = { leaked: 5 };
            const obj = Object.create(parent);
            obj.own = 7;

            const clone = deepCloneNullPrototype(obj) as any;

            expect(clone.own).toEqual(7);
            expect(clone.leaked).toBeUndefined();
        });
    });

    describe('ensure', () => {
        it('should not throw with true', () => {
            expect(() => ensure(true, 'yada')).not.toThrow();
        });
        it('should throw with false', () => {
            expect(() => ensure(false, 'yada')).toThrow('yada');
        });
    });
});
