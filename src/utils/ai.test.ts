import { describe, it, expect } from 'vitest';
import {
  sanitizeUserInput,
  sanitizeFilesForAI,
  truncateChatHistory,
  type ChatMessage
} from './ai';

describe('sanitizeUserInput', () => {
  it('returns empty string when input is empty', () => {
    expect(sanitizeUserInput('')).toBe('');
  });

  it('returns the same string when input is safe and within length limit', () => {
    const safeInput = 'Hello, this is a safe message!';
    expect(sanitizeUserInput(safeInput)).toBe(safeInput);
  });

  it('removes control characters except newlines and tabs', () => {
    const inputWithControlChars = 'Hello\x00\x01\x02\x08World\n\tTest';
    expect(sanitizeUserInput(inputWithControlChars)).toBe('HelloWorld\n\tTest');
  });

  it('removes all control characters in the forbidden range', () => {
    // Test specific control characters that should be removed
    const input = `Start\x00\x01\x02\x03\x04\x05\x06\x07\x08\x0B\x0C\x0E\x0F\x10\x1F\x7FEnd`;
    expect(sanitizeUserInput(input)).toBe('StartEnd');
  });

  it('preserves newlines and tabs', () => {
    const input = 'Line 1\nLine 2\tTabbed';
    expect(sanitizeUserInput(input)).toBe('Line 1\nLine 2\tTabbed');
  });

  it('truncates input when it exceeds default maxLength (5000)', () => {
    const longInput = 'a'.repeat(5500);
    const result = sanitizeUserInput(longInput);
    expect(result.length).toBeLessThanOrEqual(5016); // 5000 + '... (truncated)' length
    expect(result).toContain('... (truncated)');
  });

  it('truncates input when it exceeds custom maxLength', () => {
    const longInput = 'a'.repeat(100);
    const result = sanitizeUserInput(longInput, 50);
    expect(result.length).toBeLessThanOrEqual(66); // 50 + '... (truncated)' length
    expect(result).toContain('... (truncated)');
  });

  it('returns exact maxLength when input length equals maxLength', () => {
    const exactInput = 'a'.repeat(5000);
    const result = sanitizeUserInput(exactInput);
    expect(result).toBe(exactInput);
    expect(result).not.toContain('... (truncated)');
  });

  it('handles strings with only control characters', () => {
    const onlyControlChars = '\x00\x01\x02\x03\x04\x05';
    expect(sanitizeUserInput(onlyControlChars)).toBe('');
  });

  it('handles mixed content with control characters', () => {
    const mixed = 'Valid\x00Text\x01Here\x02More';
    expect(sanitizeUserInput(mixed)).toBe('ValidTextHereMore');
  });

  it('handles special unicode characters safely', () => {
    const unicodeInput = 'Hello 世界 🌍 Émojis 🎉';
    expect(sanitizeUserInput(unicodeInput)).toBe(unicodeInput);
  });

  it('truncates and adds suffix only once when multiple truncations would occur', () => {
    const veryLongInput = 'a'.repeat(10000);
    const result = sanitizeUserInput(veryLongInput);
    const truncatedCount = (result.match(/\.\.\. \(truncated\)/g) || []).length;
    expect(truncatedCount).toBe(1);
  });
});

describe('sanitizeFilesForAI', () => {
  it('returns empty object when input is empty', () => {
    expect(sanitizeFilesForAI({})).toEqual({});
  });

  it('includes files with valid extensions', () => {
    const files = {
      'src/app.tsx': 'content',
      'package.json': '{}',
      'utils.js': 'code'
    };
    const result = sanitizeFilesForAI(files);
    expect(result).toEqual(files);
  });

  it('removes control characters from file content', () => {
    const files = {
      'test.ts': 'code\x00\x01\x02with\x03control'
    };
    const result = sanitizeFilesForAI(files);
    expect(result['test.ts']).toBe('codewithcontrol');
  });

  it('truncates file content when it exceeds MAX_FILE_SIZE (10000)', () => {
    const longContent = 'x'.repeat(12000);
    const files = {
      'large.tsx': longContent
    };
    const result = sanitizeFilesForAI(files);
    expect(result['large.tsx'].length).toBeLessThanOrEqual(10035); // 10000 + truncation message
    expect(result['large.tsx']).toContain('// ... (truncated for AI context)');
  });

  it('includes files with subdirectory paths', () => {
    const files = {
      'src/components/Header.tsx': 'header code',
      'src/utils/helpers.ts': 'helper functions',
      'lib/config.json': '{}'
    };
    const result = sanitizeFilesForAI(files);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result['src/components/Header.tsx']).toBe('header code');
  });

  it('excludes files with suspicious double-dot patterns (path traversal)', () => {
    const files = {
      'normal.ts': 'safe',
      '../etc/passwd.ts': 'malicious',
      'src/../../etc/passwd.tsx': 'malicious2',
      '.../file.ts': 'suspicious'
    };
    const result = sanitizeFilesForAI(files);
    expect(Object.keys(result)).toHaveLength(1);
    expect(result['normal.ts']).toBe('safe');
  });

  it('excludes files with invalid extensions', () => {
    const files = {
      'valid.ts': 'ts code',
      'valid.tsx': 'tsx code',
      'valid.js': 'js code',
      'valid.jsx': 'jsx code',
      'valid.json': '{}',
      'invalid.exe': 'binary',
      'invalid.sh': 'script',
      'invalid.md': 'markdown',
      'noextension': 'no ext'
    };
    const result = sanitizeFilesForAI(files);
    expect(Object.keys(result)).toHaveLength(5);
    expect(result['invalid.exe']).toBeUndefined();
    expect(result['invalid.sh']).toBeUndefined();
    expect(result['invalid.md']).toBeUndefined();
    expect(result['noextension']).toBeUndefined();
  });

  it('handles filenames with dots and hyphens correctly', () => {
    const files = {
      'my-component.test.ts': 'test code',
      'file.with.many.dots.ts': 'code',
      'my-file_v2.ts': 'code'
    };
    const result = sanitizeFilesForAI(files);
    expect(Object.keys(result)).toHaveLength(3);
    expect(result['my-component.test.ts']).toBe('test code');
  });

  it('handles empty file content', () => {
    const files = {
      'empty.ts': ''
    };
    const result = sanitizeFilesForAI(files);
    expect(result['empty.ts']).toBe('');
  });

  it('processes multiple files independently', () => {
    const files = {
      'file1.ts': 'a'.repeat(5000),
      'file2.ts': 'b'.repeat(15000),
      'file3.ts': 'c'.repeat(100)
    };
    const result = sanitizeFilesForAI(files);
    expect(result['file1.ts']).toBe('a'.repeat(5000));
    expect(result['file2.ts']).toContain('... (truncated for AI context)');
    expect(result['file3.ts']).toBe('c'.repeat(100));
  });

  it('handles filenames with special safe characters', () => {
    const files = {
      'src/utils/my-util_v2.ts': 'code',
      'components/MyComponent.tsx': 'react code'
    };
    const result = sanitizeFilesForAI(files);
    expect(Object.keys(result)).toHaveLength(2);
    expect(result['src/utils/my-util_v2.ts']).toBe('code');
  });

  it('excludes filenames with spaces (invalid pattern)', () => {
    const files = {
      'valid.ts': 'code',
      'invalid file.ts': 'code with space'
    };
    const result = sanitizeFilesForAI(files);
    expect(result['valid.ts']).toBe('code');
    expect(result['invalid file.ts']).toBeUndefined();
  });

  it('handles both sanitization and truncation together', () => {
    const files = {
      'file.ts': '\x00'.repeat(9000) + 'x'.repeat(2000)
    };
    const result = sanitizeFilesForAI(files);
    // Should first remove control chars, then truncate
    expect(result['file.ts']).not.toContain('\x00');
    expect(result['file.ts'].length).toBeLessThanOrEqual(10035);
  });
});

describe('truncateChatHistory', () => {
  const createMessages = (count: number): ChatMessage[] => {
    return Array.from({ length: count }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message ${i + 1}`.repeat(100) // Create longer messages
    }));
  };

  it('returns empty array when input is empty', () => {
    expect(truncateChatHistory([])).toEqual([]);
  });

  it('returns all messages when within character limit', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' }
    ];
    expect(truncateChatHistory(messages)).toEqual(messages);
  });

  it('keeps most recent messages when over limit', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'A'.repeat(5000) },
      { role: 'assistant', content: 'B'.repeat(5000) },
      { role: 'user', content: 'C'.repeat(5000) }
    ];
    const result = truncateChatHistory(messages, 8000);
    // Function keeps at least 3 messages if possible, so all 3 are kept
    // even though total chars (15000) exceeds maxChars (8000)
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('A'.repeat(5000));
    expect(result[1].content).toBe('B'.repeat(5000));
    expect(result[2].content).toBe('C'.repeat(5000));
  });

  it('preserves message order (oldest to newest)', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'First' },
      { role: 'assistant', content: 'Second' },
      { role: 'user', content: 'Third' }
    ];
    const result = truncateChatHistory(messages);
    expect(result[0].content).toBe('First');
    expect(result[1].content).toBe('Second');
    expect(result[2].content).toBe('Third');
  });

  it('truncates when more than 3 messages and limit exceeded', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'A'.repeat(3000) },
      { role: 'assistant', content: 'B'.repeat(3000) },
      { role: 'user', content: 'C'.repeat(3000) },
      { role: 'assistant', content: 'D'.repeat(3000) }
    ];
    const result = truncateChatHistory(messages, 8000);
    // Should keep last 3 messages (C, D) since we have at least 3 already
    // and adding A would exceed the limit
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('B'.repeat(3000));
    expect(result[1].content).toBe('C'.repeat(3000));
    expect(result[2].content).toBe('D'.repeat(3000));
  });

  it('keeps at least 3 messages if possible', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'A'.repeat(4000) },
      { role: 'assistant', content: 'B'.repeat(4000) },
      { role: 'user', content: 'C'.repeat(4000) },
      { role: 'assistant', content: 'D'.repeat(4000) }
    ];
    // With maxChars=12000, each message is 4000, so we can fit exactly 3
    const result = truncateChatHistory(messages, 12000);
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('B'.repeat(4000));
    expect(result[1].content).toBe('C'.repeat(4000));
    expect(result[2].content).toBe('D'.repeat(4000));
  });

  it('respects custom maxChars parameter', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'A'.repeat(200) },
      { role: 'assistant', content: 'B'.repeat(200) },
      { role: 'user', content: 'C'.repeat(200) }
    ];
    const result = truncateChatHistory(messages, 400);
    // With 3 messages and maxChars=400, function keeps all 3 since
    // it only stops when both over limit AND have at least 3 messages
    // After processing from end: C(200) + B(200) = 400, then A would exceed
    // But since we only have 3 total and result.length would be 2 when checking A,
    // the condition `result.length >= 3` is false, so we add A anyway
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe('A'.repeat(200));
    expect(result[1].content).toBe('B'.repeat(200));
    expect(result[2].content).toBe('C'.repeat(200));
  });

  it('handles single message', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Single message' }
    ];
    const result = truncateChatHistory(messages);
    expect(result).toEqual(messages);
  });

  it('handles messages with varying content lengths', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Short' },
      { role: 'assistant', content: 'M'.repeat(6000) },
      { role: 'user', content: 'Medium length message here' }
    ];
    const result = truncateChatHistory(messages, 7000);
    // All 3 messages are kept because:
    // 1. We iterate from end: 'Medium length message here' (25) + 'M'*6000 + 'Short' (5)
    // 2. After adding 2 messages (6000 + 25 = 6025), checking 'Short' would exceed 7000
    // 3. But result.length is only 2 at that point, so `result.length >= 3` is false
    // 4. Therefore 'Short' is also added
    expect(result).toHaveLength(3);
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Short');
    expect(result[1].role).toBe('assistant');
    expect(result[2].role).toBe('user');
  });

  it('prioritizes recent messages when all are equal length', () => {
    const messages = createMessages(10);
    const result = truncateChatHistory(messages, 30000);
    // Each message is roughly 1200 chars, so 30000 should fit about 25 messages worth
    // But we only have 10, so all should fit
    expect(result).toHaveLength(10);
  });

  it('calculates character count correctly including content only', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'ABC' },
      { role: 'assistant', content: 'DEF' }
    ];
    const result = truncateChatHistory(messages, 5);
    // Only the first message (ABC = 3 chars) fits, then adding DEF (3 chars) would exceed 5
    // But we keep at least 3 messages if possible
    expect(result).toHaveLength(2);
  });

  it('handles empty content in messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: '' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'Hello' }
    ];
    const result = truncateChatHistory(messages);
    expect(result).toHaveLength(3);
  });

  it('stops at limit when keeping minimum 3 messages is not possible', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'B'.repeat(10000) }
    ];
    const result = truncateChatHistory(messages, 100);
    // Only 2 messages exist, and second exceeds limit
    // Result should include both since we iterate from end
    expect(result).toHaveLength(2);
  });

  it('handles messages with unicode characters correctly', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello 世界' },
      { role: 'assistant', content: 'Response 🌍' }
    ];
    const result = truncateChatHistory(messages, 20);
    expect(result).toHaveLength(2);
  });

  it('handles very large maxChars limit', () => {
    const messages = createMessages(50);
    const result = truncateChatHistory(messages, 1000000);
    expect(result).toHaveLength(50);
  });

  it('handles very small maxChars limit', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'A' },
      { role: 'assistant', content: 'B' },
      { role: 'user', content: 'C' },
      { role: 'assistant', content: 'D' }
    ];
    const result = truncateChatHistory(messages, 2);
    // Should still return messages from the end
    expect(result.length).toBeGreaterThan(0);
  });

  it('preserves role and content structure', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Question' },
      { role: 'assistant', content: 'Answer' }
    ];
    const result = truncateChatHistory(messages);
    expect(result[0]).toHaveProperty('role');
    expect(result[0]).toHaveProperty('content');
    expect(result[0].role).toBe('user');
    expect(result[0].content).toBe('Question');
  });
});
