import { describe, it, expect } from 'vitest';
import { parseAstToText, getStandardDate } from './content';

describe('content utilities', () => {
  describe('parseAstToText()', () => {
    it('returns empty string for null input', () => {
      expect(parseAstToText(null)).toBe('');
    });

    it('returns empty string for undefined input', () => {
      expect(parseAstToText(undefined)).toBe('');
    });

    it('returns string as-is for simple string input', () => {
      expect(parseAstToText('Hello world')).toBe('Hello world');
    });

    it('parses JSON string representation of AST', () => {
      const jsonAst = JSON.stringify({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }
        ]
      });
      expect(parseAstToText(jsonAst)).toBe('Hello world');
    });

    it('extracts text from simple text node', () => {
      const ast = { type: 'text', text: 'Simple text' };
      expect(parseAstToText(ast)).toBe('Simple text');
    });

    it('extracts text from nested content array', () => {
      const ast = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'First' },
              { type: 'text', text: 'sentence' }
            ]
          }
        ]
      };
      expect(parseAstToText(ast)).toBe('First sentence');
    });

    it('handles deeply nested structure', () => {
      const ast = {
        type: 'doc',
        content: [
          {
            type: 'section',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Deep text' }]
              }
            ]
          }
        ]
      };
      expect(parseAstToText(ast)).toBe('Deep text');
    });

    it('filters out empty text nodes', () => {
      const ast = {
        type: 'doc',
        content: [
          { type: 'text', text: 'Valid' },
          { type: 'text', text: '' },
          { type: 'text', text: 'text' }
        ]
      };
      expect(parseAstToText(ast)).toBe('Valid text');
    });

    it('handles malformed JSON gracefully', () => {
      expect(parseAstToText('{invalid json}')).toBe('{invalid json}');
    });

    it('handles complex nested structure with multiple levels', () => {
      const ast = {
        content: [
          {
            content: [{ text: 'Level 1' }]
          },
          {
            content: [
              { content: [{ text: 'Level 2' }] }
            ]
          }
        ]
      };
      expect(parseAstToText(ast)).toBe('Level 1 Level 2');
    });

    it('trims whitespace from result', () => {
      const ast = {
        content: [
          { text: '  padded  ' }
        ]
      };
      expect(parseAstToText(ast)).toBe('padded');
    });
  });

  describe('getStandardDate()', () => {
    it('returns date in YYYY-MM-DD format', () => {
      const result = getStandardDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns valid ISO 8601 date', () => {
      const result = getStandardDate();
      const date = new Date(result);
      expect(date.toString()).not.toBe('Invalid Date');
    });

    it('returns current date', () => {
      const result = getStandardDate();
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      expect(result).toBe(expected);
    });
  });
});
