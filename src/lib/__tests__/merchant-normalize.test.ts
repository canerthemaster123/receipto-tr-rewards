import { describe, it, expect } from 'vitest';
import { normalizeMerchantLocal } from '../merchant-normalize';

describe('normalizeMerchantLocal', () => {
  it('should normalize Migros variants', () => {
    expect(normalizeMerchantLocal('Migros')).toBe('Migros');
    expect(normalizeMerchantLocal('MIGROS')).toBe('Migros');
    expect(normalizeMerchantLocal('MigroS')).toBe('Migros');
    expect(normalizeMerchantLocal('Migros Ticaret A.S.')).toBe('Migros');
  });

  it('should normalize A101 variants', () => {
    expect(normalizeMerchantLocal('A101')).toBe('A101');
    expect(normalizeMerchantLocal('A-101')).toBe('A101');
    expect(normalizeMerchantLocal('a101')).toBe('A101');
  });

  it('should normalize BIM variants', () => {
    expect(normalizeMerchantLocal('BIM')).toBe('BIM');
    expect(normalizeMerchantLocal('BİM')).toBe('BIM');
    expect(normalizeMerchantLocal('BIM BIRLESIK MAGAZALAR')).toBe('BIM');
  });

  it('should normalize SOK variants', () => {
    expect(normalizeMerchantLocal('SOK')).toBe('SOK');
    expect(normalizeMerchantLocal('ŞOK')).toBe('SOK');
    expect(normalizeMerchantLocal('ŞOK MARKETLERI')).toBe('SOK');
  });

  it('should normalize CarrefourSA variants', () => {
    expect(normalizeMerchantLocal('CarrefourSA')).toBe('CarrefourSA');
    expect(normalizeMerchantLocal('CARREFOURSA')).toBe('CarrefourSA');
    expect(normalizeMerchantLocal('CARREFOUR')).toBe('CarrefourSA');
    expect(normalizeMerchantLocal('CARREFOUR SABANCI')).toBe('CarrefourSA');
  });

  it('should return original merchant if no match found', () => {
    expect(normalizeMerchantLocal('Local Bakery')).toBe('Local Bakery');
    expect(normalizeMerchantLocal('Teknosa')).toBe('Teknosa');
  });

  it('should handle empty or invalid inputs', () => {
    expect(normalizeMerchantLocal('')).toBe('Unknown');
    expect(normalizeMerchantLocal('   ')).toBe('Unknown');
  });

  it('should trim whitespace', () => {
    expect(normalizeMerchantLocal('  Migros  ')).toBe('Migros');
    expect(normalizeMerchantLocal('\tA101\n')).toBe('A101');
  });
});