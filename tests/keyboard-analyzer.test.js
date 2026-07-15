'use strict';

const { analyzeKeyboardAccessibility } = require('../src/analyzers/keyboard-analyzer');

describe('analyzeKeyboardAccessibility', () => {
  test('passes accessible HTML with no keyboard issues', () => {
    const html = `
      <a href="/home">Home</a>
      <button>Submit</button>
      <input type="text">
    `;
    const result = analyzeKeyboardAccessibility(html);
    // Should not have certain critical issues
    const criticalTypes = [
      'positive-tabindex',
      'click-without-keyboard',
      'mouse-only-event',
    ];
    for (const t of criticalTypes) {
      expect(result.issues.find(i => i.type === t)).toBeUndefined();
    }
  });

  test('detects positive tabindex value', () => {
    const html = `<button tabindex="2">Focus me second</button>`;
    const result = analyzeKeyboardAccessibility(html);
    const issue = result.issues.find(i => i.type === 'positive-tabindex');
    expect(issue).toBeDefined();
    expect(issue.message).toContain('tabindex="2"');
  });

  test('detects div with onclick but no role or tabindex', () => {
    const html = `<div onclick="doSomething()">Click me</div>`;
    const result = analyzeKeyboardAccessibility(html);
    const issue = result.issues.find(i => i.type === 'click-without-keyboard');
    expect(issue).toBeDefined();
  });

  test('does not flag div with proper role and tabindex for onclick', () => {
    const html = `<div role="button" tabindex="0" onclick="doSomething()">Click me</div>`;
    const result = analyzeKeyboardAccessibility(html);
    const issue = result.issues.find(i => i.type === 'click-without-keyboard');
    expect(issue).toBeUndefined();
  });

  test('detects mouse-only event without keyboard equivalent', () => {
    const html = `<div onmousedown="doSomething()">Hover action</div>`;
    const result = analyzeKeyboardAccessibility(html);
    const issue = result.issues.find(i => i.type === 'mouse-only-event');
    expect(issue).toBeDefined();
  });

  test('does not flag mouse event when keyboard equivalent is present', () => {
    const html = `<div onmousedown="doSomething()" onkeydown="doSomething()">Dual action</div>`;
    const result = analyzeKeyboardAccessibility(html);
    const issue = result.issues.find(i => i.type === 'mouse-only-event');
    expect(issue).toBeUndefined();
  });

  test('detects anchor without href and no tabindex', () => {
    const html = `<a>Not a real link</a>`;
    const result = analyzeKeyboardAccessibility(html);
    const issue = result.issues.find(i => i.type === 'anchor-without-href');
    expect(issue).toBeDefined();
  });

  test('does not flag anchor with href', () => {
    const html = `<a href="/page">Go to page</a>`;
    const result = analyzeKeyboardAccessibility(html);
    const issue = result.issues.find(i => i.type === 'anchor-without-href');
    expect(issue).toBeUndefined();
  });

  test('detects missing skip link when nav is present', () => {
    const html = `
      <nav><ul><li><a href="/">Home</a></li></ul></nav>
      <main><p>Content</p></main>
    `;
    const result = analyzeKeyboardAccessibility(html);
    const issue = result.issues.find(i => i.type === 'missing-skip-link');
    expect(issue).toBeDefined();
  });

  test('does not flag skip link issue when skip link is present', () => {
    const html = `
      <a href="#main">Skip to main content</a>
      <nav><ul><li><a href="/">Home</a></li></ul></nav>
      <main id="main"><p>Content</p></main>
    `;
    const result = analyzeKeyboardAccessibility(html);
    const issue = result.issues.find(i => i.type === 'missing-skip-link');
    expect(issue).toBeUndefined();
  });
});
