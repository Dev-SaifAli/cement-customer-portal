import { AppError } from '../../errors/app-error.js';

export const COMMERCIAL_UOM = 'TON' as const;

export function packagingQuantityFromTons(
  quantityTons: number,
  unitWeightKg: number,
  productUom: string,
) {
  assertPositive(quantityTons, 'Commercial quantity');

  if (productUom.trim().toUpperCase() === COMMERCIAL_UOM) return null;

  requireProductWeightConfiguration(unitWeightKg, productUom);
  return roundQuantity((quantityTons * 1000) / unitWeightKg, 3);
}

export function commercialTonsFromPackaging(
  packagingQuantity: number,
  unitWeightKg: number,
  productUom: string,
) {
  assertPositive(packagingQuantity, 'Packaging quantity');
  if (productUom.trim().toUpperCase() === COMMERCIAL_UOM)
    return roundQuantity(packagingQuantity, 6);

  requireProductWeightConfiguration(unitWeightKg, productUom);
  return roundQuantity((packagingQuantity * unitWeightKg) / 1000, 6);
}

export function requireProductWeightConfiguration(unitWeightKg: number, productUom: string) {
  if (productUom.trim().toUpperCase() === COMMERCIAL_UOM) return;

  if (!Number.isFinite(unitWeightKg) || unitWeightKg <= 0) {
    throw new AppError(
      'Product weight configuration is missing. Please contact administrator.',
      400,
      'PRODUCT_WEIGHT_CONFIGURATION_MISSING',
    );
  }
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
