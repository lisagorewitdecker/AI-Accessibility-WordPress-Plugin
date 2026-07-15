'use strict';

const { analyzeHeadingStructure } = require('../src/analyzers/heading-analyzer');

describe('analyzeHeadingStructure', () => {
  test('passes a well-structured heading hierarchy', () => {
    const html = `
      <h1>Page Title</h1>
      <h2>Section One</h2>
      <h3>Subsection A</h3>
      <h2>Section Two</h2>
    `;
    const result = analyzeHeadingStructure(html);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.headings).toHaveLength(4);
  });

  test('detects missing h1', () => {
    const html = `<h2>Introduction</h2><h3>Details</h3>`;
    const result = analyzeHeadingStructure(html);
    const issue = result.issues.find(i => i.type === 'missing-h1');
    expect(issue).toBeDefined();
  });

  test('detects multiple h1 elements', () => {
    const html = `<h1>First</h1><h1>Second</h1>`;
    const result = analyzeHeadingStructure(html);
    const issue = result.issues.find(i => i.type === 'multiple-h1');
    expect(issue).toBeDefined();
    expect(issue.message).toContain('2');
  });

  test('detects skipped heading level (h1 to h3)', () => {
    const html = `<h1>Title</h1><h3>Skipped Level</h3>`;
    const result = analyzeHeadingStructure(html);
    const issue = result.issues.find(i => i.type === 'skipped-heading-level');
    expect(issue).toBeDefined();
    expect(issue.message).toContain('h1');
    expect(issue.message).toContain('h3');
  });

  test('allows going from h3 back to h2 (not a skip)', () => {
    const html = `
      <h1>Title</h1>
      <h2>Section</h2>
      <h3>Sub</h3>
      <h2>Next Section</h2>
    `;
    const result = analyzeHeadingStructure(html);
    const skipIssues = result.issues.filter(i => i.type === 'skipped-heading-level');
    expect(skipIssues).toHaveLength(0);
  });

  test('detects empty heading', () => {
    const html = `<h1></h1><h2>Section</h2>`;
    const result = analyzeHeadingStructure(html);
    const issue = result.issues.find(i => i.type === 'empty-heading');
    expect(issue).toBeDefined();
  });

  test('heading text strips inner HTML tags', () => {
    const html = `<h1><span class="highlight">Page <em>Title</em></span></h1>`;
    const result = analyzeHeadingStructure(html);
    expect(result.headings[0].text).toBe('Page Title');
  });

  test('returns empty heading list for HTML with no headings', () => {
    const html = `<p>Just a paragraph</p>`;
    const result = analyzeHeadingStructure(html);
    expect(result.headings).toHaveLength(0);
    // Missing h1 should be flagged
    const issue = result.issues.find(i => i.type === 'missing-h1');
    expect(issue).toBeDefined();
  });
});
