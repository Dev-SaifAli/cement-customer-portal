export const commercialUom = 'TON' as const;
export const wholeTonQuantityMessage = 'Quantity must be a whole number of tons.';

export function isWholeTonQuantity(value: number) {
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export function isPermittedWholeTonInput(value: string) {
  return value === '' || /^\d+$/.test(value);
}

export function formatCommercialTonValue(value: number) {
  if (!Number.isFinite(value)) return 'Not provided';
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

export function formatCommercialTons(value: number) {
  return `${formatCommercialTonValue(value)} TON`;
}

export function packagingQuantityForTons(
  quantityTons: number,
  unitWeightKg: number | null | undefined,
  productUom: string,
) {
  if (!Number.isFinite(quantityTons) || quantityTons <= 0) return null;
  if (productUom.trim().toUpperCase() === commercialUom) return null;
  if (!unitWeightKg || !Number.isFinite(unitWeightKg) || unitWeightKg <= 0) return null;
  return Math.round(((quantityTons * 1000) / unitWeightKg + Number.EPSILON) * 1000) / 1000;
}
