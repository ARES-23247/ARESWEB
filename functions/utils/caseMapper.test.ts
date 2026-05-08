import { describe, it, expect } from 'vitest';
import { toSnakeCase, mapToSnakeCase, camelToSnake } from './caseMapper';

describe('caseMapper utility', () => {
  describe('camelToSnake()', () => {
    it('converts single uppercase word', () => {
      expect(camelToSnake('Date')).toBe('_date');
    });

    it('converts camelCase to snake_case', () => {
      expect(camelToSnake('dateStart')).toBe('date_start');
      expect(camelToSnake('isPotluck')).toBe('is_potluck');
      expect(camelToSnake('firstName')).toBe('first_name');
    });

    it('handles multiple uppercase letters', () => {
      expect(camelToSnake('userID')).toBe('user_i_d');
      expect(camelToSnake('parseURLToJSON')).toBe('parse_u_r_l_to_j_s_o_n');
    });

    it('returns lowercase for single lowercase word', () => {
      expect(camelToSnake('name')).toBe('name');
    });

    it('handles empty string', () => {
      expect(camelToSnake('')).toBe('');
    });
  });

  describe('toSnakeCase()', () => {
    it('converts camelCase object keys to snake_case', () => {
      const input = { dateStart: '2024-01-01', isPotluck: true };
      const result = toSnakeCase(input);

      expect(result).toHaveProperty('date_start', '2024-01-01');
      expect(result).toHaveProperty('is_potluck', true);
    });

    it('preserves original camelCase keys', () => {
      const input = { firstName: 'John' };
      const result = toSnakeCase(input);

      expect(result).toHaveProperty('first_name', 'John');
      expect(result).toHaveProperty('firstName', 'John');
    });

    it('handles already snake_case keys idempotently', () => {
      const input = { first_name: 'Jane' };
      const result = toSnakeCase(input);

      expect(result).toHaveProperty('first_name', 'Jane');
    });

    it('handles nested values (does not recurse)', () => {
      const input = { user: { name: 'John' } };
      const result = toSnakeCase(input);

      // The nested object itself is preserved as-is
      expect(result.user).toEqual({ name: 'John' });
    });

    it('handles null input', () => {
      expect(toSnakeCase(null as never)).toBe(null);
    });

    it('handles non-object input', () => {
      expect(toSnakeCase('string' as never)).toBe('string');
      expect(toSnakeCase(123 as never)).toBe(123);
    });

    it('handles empty object', () => {
      expect(toSnakeCase({})).toEqual({});
    });

    it('handles mixed camelCase and snake_case', () => {
      const input = {
        firstName: 'John',
        last_name: 'Doe',
        emailAddress: 'john@example.com',
      };
      const result = toSnakeCase(input);

      expect(result.first_name).toBe('John');
      expect(result.last_name).toBe('Doe');
      expect(result.email_address).toBe('john@example.com');
    });
  });

  describe('mapToSnakeCase()', () => {
    it('maps array of objects to snake_case', () => {
      const input = [
        { firstName: 'John', lastName: 'Doe' },
        { firstName: 'Jane', lastName: 'Smith' },
      ];
      const result = mapToSnakeCase(input);

      expect(result[0].first_name).toBe('John');
      expect(result[0].last_name).toBe('Doe');
      expect(result[1].first_name).toBe('Jane');
      expect(result[1].last_name).toBe('Smith');
    });

    it('handles empty array', () => {
      expect(mapToSnakeCase([])).toEqual([]);
    });

    it('handles single element array', () => {
      const input = [{ isActive: true }];
      const result = mapToSnakeCase(input);

      expect(result[0].is_active).toBe(true);
    });
  });
});
