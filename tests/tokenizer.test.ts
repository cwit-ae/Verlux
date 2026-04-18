import { tokenize, phraseWindows } from '../src/engine/tokenizer';

describe('Tokenizer', () => {
  describe('tokenize', () => {
    it('splits text into word tokens', () => {
      const tokens = tokenize('hello world');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toBe('hello');
      expect(tokens[1].value).toBe('world');
    });

    it('preserves correct positions', () => {
      const tokens = tokenize('hello world');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(5);
      expect(tokens[1].start).toBe(6);
      expect(tokens[1].end).toBe(11);
    });

    it('handles punctuation', () => {
      const tokens = tokenize('hello, world!');
      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toBe('hello');
      expect(tokens[1].value).toBe('world');
    });

    it('handles multiple spaces', () => {
      const tokens = tokenize('hello    world');
      expect(tokens).toHaveLength(2);
    });

    it('handles empty input', () => {
      const tokens = tokenize('');
      expect(tokens).toHaveLength(0);
    });
  });

  describe('phraseWindows', () => {
    it('generates n-gram windows', () => {
      const tokens = tokenize('one two three four');
      const windows = phraseWindows(tokens, 3);

      // Size 2: (one two), (two three), (three four) = 3
      // Size 3: (one two three), (two three four) = 2
      expect(windows).toHaveLength(5);
    });

    it('includes correct phrase text', () => {
      const tokens = tokenize('fuck you man');
      const windows = phraseWindows(tokens, 2);

      expect(windows.some(w => w.phrase === 'fuck you')).toBe(true);
      expect(windows.some(w => w.phrase === 'you man')).toBe(true);
    });
  });
});
