import { describe, expect, it } from 'vitest';
import { inlineText, renderBlock, renderCode, renderInline } from '../../../src/lib/markdown';

describe('renderInline', () => {
  it('escapes HTML, so a bare <T> from the notes shows as text', () => {
    expect(renderInline('List<T> <script>alert(1)</script>')).toBe('List&lt;T&gt; &lt;script&gt;alert(1)&lt;/script&gt;');
  });
  it('renders code spans, bold, italics and http(s) links only', () => {
    expect(renderInline('Use `List<T>` with **care**, *really*')).toBe('Use <code>List&lt;T&gt;</code> with <strong>care</strong>, <em>really</em>');
    expect(renderInline('[docs](https://learn.microsoft.com/a?b=1&c=2)')).toBe(
      '<a href="https://learn.microsoft.com/a?b=1&amp;c=2" class="external" target="_blank" rel="noopener noreferrer">docs</a>',
    );
    expect(renderInline('[x](javascript:alert(1))')).not.toContain('<a');
  });
  it('leaves arithmetic and snake_case alone', () => {
    expect(renderInline('2 * 3 * 4 and my_var_name')).toBe('2 * 3 * 4 and my_var_name');
    expect(renderInline('`a ** b`')).toBe('<code>a ** b</code>');
  });
  it('honours backslash escapes', () => {
    expect(renderInline('\\*not em\\*')).toBe('*not em*');
  });
  it('gives plain text for filters and labels', () => {
    expect(inlineText('Use `List<T>` with **bold** and [docs](https://x.y)')).toBe('Use List<T> with bold and docs');
  });
});

describe('renderBlock', () => {
  it('prefixes heading ids, resolves note links to GitHub and drops dangling #anchors', async () => {
    const html = await renderBlock('#### Example\n\nSee [other](./Other%20Note.md) and [above](#top).', { idPrefix: 'q1', baseFile: 'Folder/Note.md' });
    expect(html).toContain('<h4 id="q1-example">Example</h4>');
    expect(html).toContain('href="https://github.com/18-VK/LearnYourself/blob/main/Folder/Other%20Note.md"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('and above.');
  });
  it('highlights code in the same frame as lessons, with both themes', async () => {
    const html = await renderCode('int a = 1;', 'csharp');
    expect(html).toContain('class="code-frame"');
    expect(html).toContain('class="code-copy"');
    expect(html).toContain('--shiki-dark');
  });
});
