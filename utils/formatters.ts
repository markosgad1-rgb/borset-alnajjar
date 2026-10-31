/**
 * Number & Currency Formatting Utilities
 * Provides automatic comma separators for thousands, ten-thousands, and hundred-thousands
 * (e.g. 1,000 / 10,000 / 100,000 / 1,000,000)
 * Supports positive and negative balances and decimal amounts.
 */

export const formatWithCommas = (value: string | number | undefined | null): string => {
  if (value === '' || value === null || value === undefined) return '';
  const str = value.toString().replace(/,/g, '').trim();
  const isNegative = str.startsWith('-');
  const clean = isNegative ? str.slice(1) : str;
  if (clean === '' || isNaN(Number(clean))) return str;
  
  const parts = clean.split('.');
  parts[0] = Number(parts[0]).toLocaleString('en-US');
  return (isNegative ? '-' : '') + parts.join('.');
};

export const parseNumberFromCommas = (value: string | number | undefined | null): number => {
  if (value === '' || value === null || value === undefined) return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const clean = value.toString().replace(/,/g, '').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

export const handleNumericChangeWithCommas = (
  rawInput: string,
  setter: (formatted: string) => void,
  allowNegative = false
) => {
  const isNegative = allowNegative && rawInput.trim().startsWith('-');
  const clean = rawInput.replace(/[^0-9.]/g, '');
  if (clean === '') {
    setter(isNegative ? '-' : '');
    return;
  }
  
  const parts = clean.split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? '.' + parts.slice(1).join('') : '';
  
  const formattedInt = integerPart ? Number(integerPart).toLocaleString('en-US') : '0';
  setter((isNegative ? '-' : '') + formattedInt + decimalPart);
};
