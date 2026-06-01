/* eslint-disable id-length */
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
        a: [
          1,
          {
            b: { c: 7 },
          },
          3,
        ],
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

      // eslint-disable-next-line no-proto
      expect(clone.__proto__).toBeUndefined();
      expect(clone.constructor).toBeUndefined();
    });

    it('should preserve Date instances instead of emptying them', () => {
      const date = new Date('2026-05-29T12:34:56.000Z');
      const obj = { card: { created_at: date } };

      const clone = deepCloneNullPrototype(obj) as any;

      expect(clone.card.created_at).toBeInstanceOf(Date);
      expect(clone.card.created_at.getTime()).toEqual(date.getTime());
      expect(clone.card.created_at.toISOString()).toEqual(date.toISOString());

      // Cloned by value, not shared by reference.
      clone.card.created_at.setFullYear(2_000);
      expect(date.getFullYear()).toEqual(2_026);
    });

    it('should preserve Dates nested in arrays', () => {
      const date = new Date('2026-05-29T12:34:56.000Z');
      const clone = deepCloneNullPrototype({ dates: [date] }) as any;

      expect(clone.dates[0]).toBeInstanceOf(Date);
      expect(clone.dates[0].getTime()).toEqual(date.getTime());
    });

    it('should preserve RegExp by value', () => {
      const clone = deepCloneNullPrototype({ r: /ab+c/gi }) as any;

      expect(clone.r).toBeInstanceOf(RegExp);
      expect(clone.r.source).toEqual('ab+c');
      expect(clone.r.flags).toEqual('gi');
    });

    it('should preserve URL by value', () => {
      const u = new URL('https://x.com/p?q=1');
      const clone = deepCloneNullPrototype({ u }) as any;

      expect(clone.u).toBeInstanceOf(URL);
      expect(clone.u.href).toEqual('https://x.com/p?q=1');
      expect(clone.u).not.toBe(u);
    });

    it('should copy a Node Buffer by value, downgrading it to a Uint8Array', () => {
      // The package is environment-agnostic, so a Buffer is preserved as bytes
      // in a plain Uint8Array rather than via the Node-only Buffer global.
      const buf = Buffer.from('hi');
      const clone = deepCloneNullPrototype({ buf }) as any;

      expect(clone.buf).toBeInstanceOf(Uint8Array);
      expect([...clone.buf]).toEqual([...buf]);

      clone.buf[0] = 0;
      expect(buf[0]).toEqual(0x68);
    });

    it('should copy TypedArrays by value, preserving the subclass', () => {
      const arr = new Uint16Array([1, 2, 3]);
      const clone = deepCloneNullPrototype({ arr }) as any;

      expect(clone.arr).toBeInstanceOf(Uint16Array);
      expect([...clone.arr]).toEqual([1, 2, 3]);

      clone.arr[0] = 9;
      expect(arr[0]).toEqual(1);
    });

    it('should copy DataView and ArrayBuffer by value', () => {
      const ab = new ArrayBuffer(4);
      new Uint8Array(ab)[0] = 7;
      const view = new DataView(ab);
      const clone = deepCloneNullPrototype({ ab, view }) as any;

      expect(clone.ab).toBeInstanceOf(ArrayBuffer);
      expect(clone.ab).not.toBe(ab);
      expect(new Uint8Array(clone.ab)[0]).toEqual(7);

      expect(clone.view).toBeInstanceOf(DataView);
      expect(clone.view.getUint8(0)).toEqual(7);
      clone.view.setUint8(0, 0);
      expect(view.getUint8(0)).toEqual(7);
    });

    it('should deep-clone Maps recursively', () => {
      const map = new Map<string, any>([['a', { n: 1 }]]);
      const clone = deepCloneNullPrototype({ map }) as any;

      expect(clone.map).toBeInstanceOf(Map);
      expect(clone.map.get('a')).toEqual({ n: 1 });

      clone.map.get('a').n = 2;
      expect(map.get('a')!.n).toEqual(1);
    });

    it('should deep-clone Sets recursively', () => {
      const set = new Set<any>([{ n: 1 }]);
      const clone = deepCloneNullPrototype({ set }) as any;

      expect(clone.set).toBeInstanceOf(Set);
      expect([...clone.set]).toEqual([{ n: 1 }]);
      expect(clone.set).not.toBe(set);
    });

    it('should resolve circular references instead of overflowing', () => {
      const obj: any = { a: 1 };
      obj.self = obj;

      const clone = deepCloneNullPrototype(obj) as any;

      expect(clone.a).toEqual(1);
      expect(clone.self).toBe(clone);
      expect(clone.self.self.a).toEqual(1);
    });

    it('should resolve circular references through arrays', () => {
      const arr: any[] = [];
      arr.push(arr);

      const clone = deepCloneNullPrototype({ arr }) as any;

      expect(clone.arr[0]).toBe(clone.arr);
    });

    it('should defer getter invocation until the property is read', () => {
      let calls = 0;
      const obj: any = {};
      Object.defineProperty(obj, 'live', {
        enumerable: true,
        get() {
          calls += 1;
          return { n: calls };
        },
      });

      const clone = deepCloneNullPrototype({ obj }) as any;
      expect(calls).toEqual(0);

      const read = clone.obj.live;
      expect(read).toEqual({ n: 1 });
      expect(calls).toEqual(1);
    });

    it('should null-prototype strip the result of a lazily-invoked getter', () => {
      class Holder {
        public ok = 1;

        public method() {
          return 'x';
        }
      }
      const obj: any = {};
      Object.defineProperty(obj, 'live', {
        enumerable: true,
        get() {
          return new Holder();
        },
      });

      const clone = deepCloneNullPrototype({ obj }) as any;
      const value = clone.obj.live;

      // Own field survives; the prototype (and its `method`) is stripped, so the
      // returned object can't be used to reach the class prototype.
      expect(value.ok).toEqual(1);
      expect(Object.getPrototypeOf(value)).toBeNull();
      expect(value.method).toBeUndefined();
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
