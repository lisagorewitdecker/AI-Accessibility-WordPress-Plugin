'use strict';

const { checkColorContrast, relativeLuminance, parseColor } = require('../src/analyzers/color-contrast');

describe('checkColorContrast', () => {
  test('white on black passes AAA', () => {
    const result = checkColorContrast('#ffffff', '#000000');
    expect(result.ratio).toBe(21);
    expect(result.passesAA).toBe(true);
    expect(result.passesAAA).toBe(true);
    expect(result.wcagLevel).toBe('AAA');
  });

  test('black on white passes AAA', () => {
    const result = checkColorContrast('#000000', '#ffffff');
    expect(result.ratio).toBe(21);
    expect(result.wcagLevel).toBe('AAA');
  });

  test('same colour returns ratio 1 and fails', () => {
    const result = checkColorContrast('#888888', '#888888');
    expect(result.ratio).toBe(1);
    expect(result.passesAA).toBe(false);
    expect(result.wcagLevel).toBe('FAIL');
  });

  test('low-contrast pair fails AA', () => {
    // Light grey on white — very low contrast
    const result = checkColorContrast('#dddddd', '#ffffff');
    expect(result.passesAA).toBe(false);
    expect(result.wcagLevel).toBe('FAIL');
  });

  test('ratio sufficient for AA large text but not AA normal', () => {
    // #8a8a8a on white ≈ 3.45:1 — passes AA large (≥3:1) but fails AA normal (≥4.5:1)
    const result       = checkColorContrast('#8a8a8a', '#ffffff');
    const resultLarge  = checkColorContrast('#8a8a8a', '#ffffff', { isLargeText: true });
    expect(result.passesAA).toBe(false);
    expect(resultLarge.passesAA).toBe(true);
  });

  test('shorthand hex (#rgb) is accepted', () => {
    const result = checkColorContrast('#fff', '#000');
    expect(result.ratio).toBe(21);
    expect(result.passesAA).toBe(true);
  });

  test('rgb() colour strings are accepted', () => {
    const result = checkColorContrast('rgb(0, 0, 0)', 'rgb(255, 255, 255)');
    expect(result.ratio).toBe(21);
    expect(result.passesAA).toBe(true);
  });

  test('rgba() colour strings are accepted', () => {
    const result = checkColorContrast('rgba(0, 0, 0, 1)', 'rgba(255, 255, 255, 0.9)');
    expect(result.ratio).toBe(21);
  });

  test('invalid colour returns error and fails', () => {
    const result = checkColorContrast('notacolor', '#ffffff');
    expect(result.passesAA).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('parseColor', () => {
  test('returns null for null input', () => {
    expect(parseColor(null)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(parseColor('')).toBeNull();
  });

  test('parses 6-digit hex', () => {
    const c = parseColor('#ff0000');
    expect(c).toEqual({ r: 255, g: 0, b: 0 });
  });

  test('parses 3-digit hex', () => {
    const c = parseColor('#f00');
    expect(c).toEqual({ r: 255, g: 0, b: 0 });
  });

  test('parses rgb()', () => {
    const c = parseColor('rgb(10, 20, 30)');
    expect(c).toEqual({ r: 10, g: 20, b: 30 });
  });
});

describe('relativeLuminance', () => {
  test('pure white has luminance 1', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 5);
  });

  test('pure black has luminance 0', () => {
    expect(relativeLuminance(0, 0, 0)).toBe(0);
  });
});
