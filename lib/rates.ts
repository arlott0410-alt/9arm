export type Currency = 'LAK' | 'THB' | 'USD';

export type RateSnapshot = Record<string, number>;

export function convertBetween(
  amountMinor: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rates: RateSnapshot
): number {
  if (fromCurrency === toCurrency) return amountMinor;
  const key = `${fromCurrency}_${toCurrency}`;
  const rate = rates[key];
  if (typeof rate !== 'number') return 0;
  const fromMajor = fromCurrency === 'LAK' ? amountMinor : amountMinor / 100;
  const toMajor = fromMajor * rate;
  return toCurrency === 'LAK' ? Math.round(toMajor) : Math.round(toMajor * 100);
}

export function convertToDisplay(
  amountMinor: number,
  walletCurrency: Currency,
  displayCurrency: Currency,
  rates: RateSnapshot
): number {
  return convertBetween(amountMinor, walletCurrency, displayCurrency, rates);
}

export function convertFromDisplay(
  displayAmountMinor: number,
  displayCurrency: Currency,
  walletCurrency: Currency,
  rates: RateSnapshot
): number {
  return convertBetween(
    displayAmountMinor,
    displayCurrency,
    walletCurrency,
    rates
  );
}

export function getAllRateKeys(): string[] {
  const currencies: Currency[] = ['LAK', 'THB', 'USD'];
  const keys: string[] = [];
  for (const a of currencies) {
    for (const b of currencies) {
      if (a !== b) keys.push(`${a}_${b}`);
    }
  }
  return keys;
}
