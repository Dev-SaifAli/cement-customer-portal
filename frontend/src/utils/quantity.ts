export function formatTonQuantity(value: number) {
  if (!Number.isFinite(value)) return 'Not provided';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 3 })} TON`;
}
