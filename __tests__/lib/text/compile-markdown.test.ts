/**
 * Tests for the markdown -> (text, ranges) compiler.
 *
 * The assertions deliberately check `text.slice(start, end)` rather than raw offsets. Offsets are
 * the thing most likely to be wrong — a list marker prepended without shifting its ranges, an
 * emphasis span closed one character late — and a slice makes the failure message say WHICH text
 * got decorated instead of printing two numbers.
 */

import { MarkdownIt } from 'react-native-markdown-display';
import {
  compileMarkdown,
  DEFAULT_MARKDOWN_STYLE,
  type MarkdownStyleConfig,
} from '@/lib/text/compile-markdown';

const parser = MarkdownIt({ typographer: false });
const style: MarkdownStyleConfig = {
  ...DEFAULT_MARKDOWN_STYLE,
  boldWeight: '700',
  linkColor: '#0000ff',
  headingScales: [2, 1.5, 1.2, 1, 1, 1],
};

const compile = (src: string) => compileMarkdown(src, parser, style);
/** The decorated substring, which is what the range actually means. */
const decorated = (text: string, r: { start: number; end: number }) => text.slice(r.start, r.end);

describe('compileMarkdown', () => {
  it('returns nothing for empty input, and calls it supported', () => {
    expect(compile('   \n  ')).toEqual({ blocks: [], supported: true });
  });

  it('compiles a plain paragraph to one block with no ranges', () => {
    const { blocks, supported } = compile('In the beginning God created.');
    expect(supported).toBe(true);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('paragraph');
    expect(blocks[0].text).toBe('In the beginning God created.');
    expect(blocks[0].ranges).toEqual([]);
  });

  it('joins a soft-wrapped paragraph into one line', () => {
    // A single newline is a space in CommonMark; keeping it would break the line early.
    const { blocks } = compile('first line\nsecond line');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('first line second line');
  });

  it('marks strong and em over exactly the emphasised words', () => {
    const { blocks } = compile('God **created** the *heavens*.');
    const [block] = blocks;
    expect(block.text).toBe('God created the heavens.');

    const strong = block.ranges.find((r) => r.tag === 'strong');
    const em = block.ranges.find((r) => r.tag === 'em');
    expect(decorated(block.text, strong!)).toBe('created');
    expect(strong!.fontWeight).toBe('700');
    expect(decorated(block.text, em!)).toBe('heavens');
    expect(em!.fontStyle).toBe('italic');
  });

  it('overlaps nested emphasis instead of splitting it', () => {
    // The native side composes weight+slant into BOLD_ITALIC, so the inner span must OVERLAP the
    // outer one rather than the two being emitted as adjacent pieces.
    const { blocks } = compile('**bold with *both* inside**');
    const [block] = blocks;
    const strong = block.ranges.find((r) => r.tag === 'strong')!;
    const em = block.ranges.find((r) => r.tag === 'em')!;

    expect(decorated(block.text, strong)).toBe('bold with both inside');
    expect(decorated(block.text, em)).toBe('both');
    expect(em.start).toBeGreaterThan(strong.start);
    expect(em.end).toBeLessThan(strong.end);
  });

  it('scales and bolds a heading across the whole line', () => {
    const { blocks } = compile('## The Creation');
    const [block] = blocks;
    expect(block.kind).toBe('heading');
    expect(block.headingLevel).toBe(2);
    expect(block.text).toBe('The Creation');

    const whole = block.ranges[0];
    expect(decorated(block.text, whole)).toBe('The Creation');
    expect(whole.fontScale).toBe(1.5);
    expect(whole.fontWeight).toBe('700');
  });

  it('keeps a link href on the range and marks it interactive', () => {
    const { blocks } = compile('see [Genesis](https://example.com/gen) now');
    const link = blocks[0].ranges.find((r) => r.tag?.startsWith('link:'))!;
    expect(decorated(blocks[0].text, link)).toBe('Genesis');
    expect(link.tag).toBe('link:https://example.com/gen');
    expect(link.interactive).toBe(true);
    expect(link.color).toBe('#0000ff');
  });

  it('prefixes bullets and SHIFTS the ranges past the marker', () => {
    // The regression this guards: prepending the marker to the text without moving the ranges
    // leaves every decoration pointing a few characters to the left.
    const { blocks } = compile('- plain item\n- item with **weight**');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].kind).toBe('listItem');
    expect(blocks[0].text).toBe('•  plain item');

    const strong = blocks[1].ranges.find((r) => r.tag === 'strong')!;
    expect(decorated(blocks[1].text, strong)).toBe('weight');
  });

  it('numbers ordered lists and restarts them per list', () => {
    const first = compile('1. alpha\n2. beta\n3. gamma');
    expect(first.blocks.map((b) => b.text)).toEqual(['1. alpha', '2. beta', '3. gamma']);

    const second = compile('1. only');
    expect(second.blocks[0].text).toBe('1. only');
  });

  it('tracks depth for nested lists', () => {
    const { blocks } = compile('- outer\n  - inner');
    expect(blocks[0].depth).toBe(1);
    expect(blocks[1].depth).toBe(2);
  });

  it('compiles blockquotes and code fences as their own kinds', () => {
    const quote = compile('> quoted words');
    expect(quote.blocks[0].kind).toBe('blockquote');
    expect(quote.blocks[0].text).toBe('quoted words');

    const fence = compile('```\nconst a = 1;\n```');
    expect(fence.blocks[0].kind).toBe('code');
    // No trailing newline: it is the fence's delimiter, and keeping it draws a blank last line.
    expect(fence.blocks[0].text).toBe('const a = 1;');
  });

  it('backgrounds inline code without consuming the backticks', () => {
    const { blocks } = compile('call `render()` here');
    const code = blocks[0].ranges.find((r) => r.tag === 'code')!;
    expect(blocks[0].text).toBe('call render() here');
    expect(decorated(blocks[0].text, code)).toBe('render()');
    expect(code.backgroundColor).toBe(style.codeBackgroundColor);
  });

  it('falls back wholesale on a table rather than dropping it', () => {
    const parserWithTables = MarkdownIt({ typographer: false });
    const result = compileMarkdown('| a | b |\n|---|---|\n| 1 | 2 |', parserWithTables, style);
    expect(result.supported).toBe(false);
    expect(result.unsupportedReason).toBe('table_open');
    expect(result.blocks).toEqual([]);
  });

  it('falls back on an image, which has no span equivalent', () => {
    const result = compile('text with ![alt](https://example.com/a.png) inline');
    expect(result.supported).toBe(false);
    expect(result.unsupportedReason).toBe('image');
  });

  it('falls back on strikethrough, since StyleSpan has no such axis', () => {
    const result = compile('this is ~~gone~~ now');
    expect(result.supported).toBe(false);
  });

  it('never emits a range outside its own text', () => {
    // A blanket invariant, cheap to assert and it catches arithmetic slips the targeted cases miss.
    const doc = [
      '# Heading with *em*',
      '',
      'Paragraph with **strong**, `code`, and [a link](https://x.test).',
      '',
      '1. first **item**',
      '2. second *item*',
      '',
      '> quote with **weight**',
    ].join('\n');
    const { blocks, supported } = compile(doc);
    expect(supported).toBe(true);
    expect(blocks.length).toBeGreaterThan(4);

    for (const block of blocks) {
      for (const range of block.ranges) {
        expect(range.start).toBeGreaterThanOrEqual(0);
        expect(range.end).toBeLessThanOrEqual(block.text.length);
        expect(range.end).toBeGreaterThan(range.start);
      }
    }
  });
});
