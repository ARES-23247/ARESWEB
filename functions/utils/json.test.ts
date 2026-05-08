import { describe, it, expect } from 'vitest';
import { safeJSONParse, safeJSONStringify } from './json';

describe('JSON utility helpers', () => {
  describe('safeJSONParse()', () => {
    it('returns parsed object for valid JSON string', () => {
      const input = '{"name":"John","age":30}';
      const result = safeJSONParse(input, { default: true });
      expect(result).toEqual({ name: 'John', age: 30 });
    });

    it('returns parsed array for valid JSON array string', () => {
      const input = '[1,2,3,4,5]';
      const result = safeJSONParse<number[]>(input, []);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('returns parsed string for valid JSON string', () => {
      const input = '"hello world"';
      const result = safeJSONParse(input, 'default');
      expect(result).toBe('hello world');
    });

    it('returns parsed number for valid JSON number', () => {
      const input = '42';
      const result = safeJSONParse(input, 0);
      expect(result).toBe(42);
    });

    it('returns parsed boolean for valid JSON boolean', () => {
      const input = 'true';
      const result = safeJSONParse(input, false);
      expect(result).toBe(true);
    });

    it('returns parsed null for valid JSON null', () => {
      const input = 'null';
      const result = safeJSONParse(input, 'default');
      expect(result).toBe(null);
    });

    it('returns default value for invalid JSON string', () => {
      const input = '{invalid json}';
      const result = safeJSONParse(input, { default: true });
      expect(result).toEqual({ default: true });
    });

    it('returns default value for malformed JSON object', () => {
      const input = '{"name": "John",}';
      const result = safeJSONParse(input, {});
      expect(result).toEqual({});
    });

    it('returns default value for empty string', () => {
      const result = safeJSONParse('', { default: true });
      expect(result).toEqual({ default: true });
    });

    it('returns default value for non-JSON string', () => {
      const result = safeJSONParse('just plain text', []);
      expect(result).toEqual([]);
    });

    it('returns the value itself when input is not a string', () => {
      const obj = { name: 'John', age: 30 };
      const result = safeJSONParse(obj, { default: true });
      expect(result).toEqual(obj);
    });

    it('returns the value itself when input is a number', () => {
      const result = safeJSONParse(42, 0);
      expect(result).toBe(42);
    });

    it('returns the value itself when input is a boolean', () => {
      const result = safeJSONParse(true, false);
      expect(result).toBe(true);
    });

    it('returns the value itself when input is an array', () => {
      const arr = [1, 2, 3];
      const result = safeJSONParse(arr, []);
      expect(result).toEqual(arr);
    });

    it('returns default value when input is null (non-string)', () => {
      const result = safeJSONParse(null, { default: true });
      expect(result).toEqual({ default: true });
    });

    it('returns default value when input is undefined (non-string)', () => {
      const result = safeJSONParse(undefined, { default: true });
      expect(result).toEqual({ default: true });
    });

    it('handles complex nested objects', () => {
      const input = '{"user":{"name":"John","address":{"city":"Boston"}}}';
      const result = safeJSONParse(input, {});
      expect(result).toEqual({
        user: {
          name: 'John',
          address: { city: 'Boston' }
        }
      });
    });

    it('handles array of objects', () => {
      const input = '[{"id":1,"name":"First"},{"id":2,"name":"Second"}]';
      const result = safeJSONParse(input, []);
      expect(result).toEqual([
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' }
      ]);
    });

    it('type inference works correctly', () => {
      const input = '{"value":123}';
      const result = safeJSONParse<{ value: number }>(input, { value: 0 });
      expect(result.value).toBe(123);
    });
  });

  describe('safeJSONStringify()', () => {
    it('returns JSON string for valid object', () => {
      const input = { name: 'John', age: 30 };
      const result = safeJSONStringify(input);
      expect(result).toBe('{"name":"John","age":30}');
    });

    it('returns JSON string for valid array', () => {
      const input = [1, 2, 3, 4, 5];
      const result = safeJSONStringify(input);
      expect(result).toBe('[1,2,3,4,5]');
    });

    it('returns string as-is when input is already a string', () => {
      const input = 'already a string';
      const result = safeJSONStringify(input);
      expect(result).toBe('already a string');
    });

    it('returns JSON string for number', () => {
      const result = safeJSONStringify(42);
      expect(result).toBe('42');
    });

    it('returns JSON string for boolean true', () => {
      const result = safeJSONStringify(true);
      expect(result).toBe('true');
    });

    it('returns JSON string for boolean false', () => {
      const result = safeJSONStringify(false);
      expect(result).toBe('false');
    });

    it('returns default string for null input', () => {
      const result = safeJSONStringify(null);
      expect(result).toBe('[]');
    });

    it('returns default string for undefined input', () => {
      const result = safeJSONStringify(undefined);
      expect(result).toBe('[]');
    });

    it('returns custom default string for null input', () => {
      const result = safeJSONStringify(null, '{}');
      expect(result).toBe('{}');
    });

    it('returns custom default string for undefined input', () => {
      const result = safeJSONStringify(undefined, 'null');
      expect(result).toBe('null');
    });

    it('returns default string for circular reference', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;
      const result = safeJSONStringify(obj);
      expect(result).toBe('[]');
    });

    it('returns custom default string for circular reference', () => {
      const obj: Record<string, unknown> = { name: 'test' };
      obj.self = obj;
      const result = safeJSONStringify(obj, 'custom-default');
      expect(result).toBe('custom-default');
    });

    it('handles nested objects', () => {
      const input = {
        user: {
          name: 'John',
          address: {
            city: 'Boston',
            zip: '02108'
          }
        }
      };
      const result = safeJSONStringify(input);
      expect(result).toBe('{"user":{"name":"John","address":{"city":"Boston","zip":"02108"}}}');
    });

    it('handles array of objects', () => {
      const input = [
        { id: 1, name: 'First' },
        { id: 2, name: 'Second' }
      ];
      const result = safeJSONStringify(input);
      expect(result).toBe('[{"id":1,"name":"First"},{"id":2,"name":"Second"}]');
    });

    it('handles empty object', () => {
      const result = safeJSONStringify({});
      expect(result).toBe('{}');
    });

    it('handles empty array', () => {
      const result = safeJSONStringify([]);
      expect(result).toBe('[]');
    });

    it('handles special characters in strings', () => {
      const input = { message: 'Hello "World"!\nNew line' };
      const result = safeJSONStringify(input);
      expect(result).toBe('{"message":"Hello \\"World\\"!\\nNew line"}');
    });

    it('handles unicode characters', () => {
      const input = { emoji: '😀', chinese: '你好' };
      const result = safeJSONStringify(input);
      expect(result).toBe('{"emoji":"😀","chinese":"你好"}');
    });

    it('handles Date objects', () => {
      const date = new Date('2026-05-08T12:00:00Z');
      const result = safeJSONStringify({ date });
      // Date objects get stringified to ISO format
      expect(result).toContain('"date":"2026-05-08T');
    });

    it('respects custom default parameter', () => {
      const result = safeJSONStringify(null, 'custom-default');
      expect(result).toBe('custom-default');
    });

    it('uses [] as default default string', () => {
      const result = safeJSONStringify(null);
      expect(result).toBe('[]');
    });

    it('handles bigint gracefully (throws on stringify)', () => {
      const input = { value: BigInt(123) };
      const result = safeJSONStringify(input, 'fallback');
      expect(result).toBe('fallback');
    });

    it('ignores symbol-keyed properties (stringifies as empty object)', () => {
      const input = { [Symbol('test')]: 'value' };
      const result = safeJSONStringify(input, 'fallback');
      // Symbol keys are ignored by JSON.stringify, resulting in {}
      expect(result).toBe('{}');
    });
  });

  describe('integration: parse and stringify roundtrip', () => {
    it('roundtrips an object correctly', () => {
      const original = { name: 'John', age: 30, active: true };
      const stringified = safeJSONStringify(original);
      const parsed = safeJSONParse(stringified, {});
      expect(parsed).toEqual(original);
    });

    it('roundtrips an array correctly', () => {
      const original = [1, 2, 3, 'four', { five: 5 }];
      const stringified = safeJSONStringify(original);
      const parsed = safeJSONParse<typeof original>(stringified, []);
      expect(parsed).toEqual(original);
    });

    it('handles empty object roundtrip', () => {
      const original = {};
      const stringified = safeJSONStringify(original);
      const parsed = safeJSONParse(stringified, null);
      expect(parsed).toEqual(original);
    });

    it('handles empty array roundtrip', () => {
      const original: unknown[] = [];
      const stringified = safeJSONStringify(original);
      const parsed = safeJSONParse(original, []);
      expect(parsed).toEqual(original);
    });
  });
});
