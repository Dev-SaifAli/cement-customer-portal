import { AppError } from '../../errors/app-error.js';

export const COMMERCIAL_UOM = 'TON' as const;

export function packagingQuantityFromTons(
  quantityTons: number,
  unitWeightKg: number,
  productUom: string,
) {
  assertPositive(quantityTons, 'Commercial quantity');

  if (productUom.trim().toUpperCase() === COMMERCIAL_UOM) return null;

  assertPositive(unitWeightKg, 'Product unit weight');
  return roundQuantity((quantityTons * 1000) / unitWeightKg, 3);
}

export function commercialTonsFromPackaging(
  packagingQuantity: number,
  unitWeightKg: number,
  productUom: string,
) {
  assertPositive(packagingQuantity, 'Packaging quantity');
  if (productUom.trim().toUpperCase() === COMMERCIAL_UOM) return roundQuantity(packagingQuantity, 6);

  assertPositive(unitWeightKg, 'Product unit weight');
  return roundQuantity((packagingQuantity * unitWeightKg) / 1000, 6);
}

function assertPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new AppError(`${label} must be greater than zero.`, 400, 'QUANTITY_INVALID');
  }
}

function roundQuantity(value: number, precision: number) {
  const multiplier = 10 ** precision;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
