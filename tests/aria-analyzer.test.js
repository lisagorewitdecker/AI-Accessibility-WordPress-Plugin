'use strict';

const { analyzeAriaLabels } = require('../src/analyzers/aria-analyzer');

describe('analyzeAriaLabels', () => {
  test('passes clean HTML with no ARIA issues', () => {
    const html = `
      <button aria-label="Close dialog">×</button>
      <div id="tooltip-1">This is a tooltip</div>
      <input aria-describedby="tooltip-1" type="text">
    `;
    const result = analyzeAriaLabels(html);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test('detects aria-labelledby referencing missing id', () => {
    const html = `<button aria-labelledby="missing-id">Click</button>`;
    const result = analyzeAriaLabels(html);
    expect(result.passed).toBe(false);
    const issue = result.issues.find(i => i.type === 'aria-labelledby-missing-target');
    expect(issue).toBeDefined();
    expect(issue.message).toContain('"missing-id"');
  });

  test('passes when aria-labelledby target exists', () => {
    const html = `
      <span id="lbl">My Label</span>
      <button aria-labelledby="lbl">Click</button>
    `;
    const result = analyzeAriaLabels(html);
    const issue = result.issues.find(i => i.type === 'aria-labelledby-missing-target');
    expect(issue).toBeUndefined();
  });

  test('detects aria-describedby referencing missing id', () => {
    const html = `<input aria-describedby="help-text" type="text">`;
    const result = analyzeAriaLabels(html);
    const issue = result.issues.find(i => i.type === 'aria-describedby-missing-target');
    expect(issue).toBeDefined();
  });

  test('detects role="img" without accessible name', () => {
    const html = `<div role="img"></div>`;
    const result = analyzeAriaLabels(html);
    const issue = result.issues.find(i => i.type === 'role-img-missing-label');
    expect(issue).toBeDefined();
  });

  test('passes role="img" with aria-label', () => {
    const html = `<div role="img" aria-label="Company logo"></div>`;
    const result = analyzeAriaLabels(html);
    const issue = result.issues.find(i => i.type === 'role-img-missing-label');
    expect(issue).toBeUndefined();
  });

  test('detects empty button with no accessible name', () => {
    const html = `<button></button>`;
    const result = analyzeAriaLabels(html);
    const issue = result.issues.find(i => i.type === 'button-no-accessible-name');
    expect(issue).toBeDefined();
  });

  test('detects empty link with no accessible name', () => {
    const html = `<a href="/home"></a>`;
    const result = analyzeAriaLabels(html);
    const issue = result.issues.find(i => i.type === 'link-no-accessible-name');
    expect(issue).toBeDefined();
  });

  test('detects presentation role on button', () => {
    const html = `<button role="presentation">Click me</button>`;
    const result = analyzeAriaLabels(html);
    const issue = result.issues.find(i => i.type === 'presentation-role-on-interactive');
    expect(issue).toBeDefined();
  });
});
