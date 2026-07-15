'use strict';

const { AccessibilityAnalyzer } = require('../src/index');

describe('AccessibilityAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new AccessibilityAnalyzer();
  });

  test('throws TypeError for non-string input', async () => {
    await expect(analyzer.analyze(null)).rejects.toThrow(TypeError);
    await expect(analyzer.analyze('')).rejects.toThrow(TypeError);
    await expect(analyzer.analyze(42)).rejects.toThrow(TypeError);
  });

  test('returns a report with expected shape', async () => {
    const html = `
      <html>
        <body>
          <h1>Test Page</h1>
          <img src="dog.jpg" alt="A golden retriever">
          <a href="/">Home</a>
          <button>Click me</button>
        </body>
      </html>
    `;
    const report = await analyzer.analyze(html);

    expect(typeof report.score).toBe('number');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
    expect(['AAA', 'AA', 'A', 'FAIL']).toContain(report.wcagLevel);
    expect(typeof report.passed).toBe('boolean');
    expect(typeof report.issueCount).toBe('number');
    expect(Array.isArray(report.issues)).toBe(true);
    expect(typeof report.generatedAt).toBe('string');
    expect(report.details).toBeDefined();
  });

  test('accessible HTML returns a high score', async () => {
    const html = `
      <html>
        <body>
          <a href="#main">Skip to main content</a>
          <nav><ul><li><a href="/">Home</a></li></ul></nav>
          <main id="main">
            <h1>Welcome</h1>
            <h2>About Us</h2>
            <p>We care about accessibility.</p>
            <img src="team.jpg" alt="Our diverse team smiling in the office">
            <button>Learn More</button>
          </main>
        </body>
      </html>
    `;
    const report = await analyzer.analyze(html);
    expect(report.score).toBeGreaterThanOrEqual(80);
  });

  test('inaccessible HTML returns issues', async () => {
    const html = `
      <div>
        <img src="chart.png">
        <div onclick="go()">Click</div>
        <button></button>
      </div>
    `;
    const report = await analyzer.analyze(html);
    expect(report.issueCount).toBeGreaterThan(0);
    expect(report.passed).toBe(false);
  });

  test('colour contrast check is included when colorPairs are provided', async () => {
    const html = `<h1>Title</h1>`;
    const report = await analyzer.analyze(html, {
      colorPairs: [
        { fg: '#ffffff', bg: '#000000' },
        { fg: '#dddddd', bg: '#ffffff' },
      ],
    });
    expect(report.details.colorContrast).toBeDefined();
    expect(report.details.colorContrast.results).toHaveLength(2);
  });

  test('checkColorContrast convenience method works', () => {
    const result = analyzer.checkColorContrast('#000000', '#ffffff');
    expect(result.passesAA).toBe(true);
    expect(result.ratio).toBe(21);
  });

  test('analyzeAltText method works standalone', () => {
    const result = analyzer.analyzeAltText('<img src="a.jpg">');
    expect(result.issues[0].type).toBe('img-missing-alt');
  });

  test('analyzeAriaLabels method works standalone', () => {
    const result = analyzer.analyzeAriaLabels('<button></button>');
    expect(result.issues.some(i => i.type === 'button-no-accessible-name')).toBe(true);
  });

  test('analyzeHeadingStructure method works standalone', () => {
    const result = analyzer.analyzeHeadingStructure('<h2>Section</h2>');
    expect(result.issues.some(i => i.type === 'missing-h1')).toBe(true);
  });

  test('analyzeKeyboardAccessibility method works standalone', () => {
    const result = analyzer.analyzeKeyboardAccessibility('<div onclick="x()">Clickable</div>');
    expect(result.issues.some(i => i.type === 'click-without-keyboard')).toBe(true);
  });

  test('report includes generatedAt ISO timestamp', async () => {
    const report = await analyzer.analyze('<h1>Hello</h1>');
    expect(new Date(report.generatedAt).toISOString()).toBe(report.generatedAt);
  });

  test('report metadata is included when provided', async () => {
    const report = await analyzer.analyze('<h1>Test</h1>', {
      url: 'https://example.com',
      title: 'Test Page',
    });
    expect(report.meta.url).toBe('https://example.com');
    expect(report.meta.title).toBe('Test Page');
  });
});
