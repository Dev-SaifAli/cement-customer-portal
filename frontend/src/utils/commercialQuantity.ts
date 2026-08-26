export const commercialUom = 'TON' as const;

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
