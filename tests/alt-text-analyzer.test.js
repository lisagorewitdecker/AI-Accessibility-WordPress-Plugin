'use strict';

const { analyzeAltText } = require('../src/analyzers/alt-text-analyzer');

describe('analyzeAltText', () => {
  test('passes when all images have descriptive alt text', () => {
    const html = `
      <img src="dog.jpg" alt="A golden retriever playing fetch in the park">
      <img src="logo.png" alt="Acme Corp logo">
    `;
    const result = analyzeAltText(html);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.images).toHaveLength(2);
    expect(result.images[0].status).toBe('ok');
  });

  test('detects missing alt attribute', () => {
    const html = `<img src="chart.png">`;
    const result = analyzeAltText(html);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].type).toBe('img-missing-alt');
    expect(result.images[0].status).toBe('missing-alt');
  });

  test('flags non-decorative images with empty alt', () => {
    const html = `<img src="product-photo.jpg" alt="">`;
    const result = analyzeAltText(html);
    expect(result.passed).toBe(false);
    const issue = result.issues.find(i => i.type === 'img-empty-alt-review');
    expect(issue).toBeDefined();
    expect(result.images[0].status).toBe('empty-alt');
  });

  test('accepts empty alt on likely-decorative images', () => {
    const html = `<img src="spacer.gif" alt="">`;
    const result = analyzeAltText(html);
    // Should not flag as empty-alt-review because filename contains "spacer"
    const reviewIssue = result.issues.find(i => i.type === 'img-empty-alt-review');
    expect(reviewIssue).toBeUndefined();
    expect(result.images[0].status).toBe('decorative-ok');
  });

  test('flags redundant alt text starting with "image"', () => {
    const html = `<img src="cat.jpg" alt="Image of a cat">`;
    const result = analyzeAltText(html);
    expect(result.passed).toBe(false);
    expect(result.issues[0].type).toBe('img-poor-alt');
    expect(result.images[0].status).toBe('poor-alt');
  });

  test('returns empty arrays for HTML with no images', () => {
    const result = analyzeAltText('<p>Hello world</p>');
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.images).toHaveLength(0);
  });

  test('handles self-closing img tags', () => {
    const html = `<img src="test.jpg" alt="Test image" />`;
    const result = analyzeAltText(html);
    expect(result.passed).toBe(true);
    expect(result.images[0].status).toBe('ok');
  });

  test('detects multiple issues in one document', () => {
    const html = `
      <img src="a.jpg">
      <img src="b.jpg">
      <img src="c.jpg" alt="">
    `;
    const result = analyzeAltText(html);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });
});
