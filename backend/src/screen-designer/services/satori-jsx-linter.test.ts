import { describe, expect, it } from 'bun:test';
import { formatSatoriLintIssues, lintSatoriNode } from './satori-jsx-linter';

describe('satori jsx linter', () => {
  it('reports the exact path for a div with multiple children and no display', () => {
    const issues = lintSatoriNode({
      type: 'div',
      props: {},
      children: [
        { type: 'span', props: {}, children: ['One'] },
        { type: 'span', props: {}, children: ['Two'] },
      ],
    });

    expect(formatSatoriLintIssues(issues)).toBe(
      'root: <div> has 2 child nodes but no Satori-compatible display. Set style.display to "flex", "contents", or "none".',
    );
  });

  it('ignores formatting whitespace children', () => {
    const issues = lintSatoriNode({
      type: 'div',
      props: {},
      children: [
        '\n  ',
        { type: 'span', props: {}, children: ['One'] },
        '\n',
      ],
    });

    expect(issues).toHaveLength(0);
  });

  it('accepts an explicit Satori-compatible display', () => {
    const issues = lintSatoriNode({
      type: 'div',
      props: { style: { display: 'flex' } },
      children: [
        { type: 'span', props: {}, children: ['One'] },
        { type: 'span', props: {}, children: ['Two'] },
      ],
    });

    expect(issues).toHaveLength(0);
  });

  it('reports nested child paths', () => {
    const issues = lintSatoriNode({
      type: 'section',
      props: {},
      children: [{
        type: 'div',
        props: {},
        children: [
          { type: 'span', props: {}, children: ['One'] },
          { type: 'span', props: {}, children: ['Two'] },
        ],
      }],
    });

    expect(formatSatoriLintIssues(issues)).toContain('root.section[0]');
  });
});
