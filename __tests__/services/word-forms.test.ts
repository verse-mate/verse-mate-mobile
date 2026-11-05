import { baseForms } from '@/services/word-forms';

describe('baseForms', () => {
  it.each([
    ['sons', 'son'],
    ['cities', 'city'],
    ['carried', 'carry'],
    ['searches', 'search'],
    ['eyes', 'eye'],
    ['places', 'place'],
    ['toes', 'toe'],
    ['called', 'call'],
    ['hoped', 'hope'],
    ['visited', 'visit'],
    ['coming', 'come'],
    ['brought', 'bring'],
  ])('%s → %s first', (word, base) => {
    expect(baseForms(word)[0]).toBe(base);
  });

  it('undoes a doubled consonant (sinned → sin)', () => {
    expect(baseForms('sinned')).toContain('sin');
  });

  it('never offers the word itself or a one-letter stem', () => {
    expect(baseForms('is')).toEqual([]);
    expect(baseForms('used')).not.toContain('us');
    expect(baseForms('sons')).not.toContain('sons');
  });
});
