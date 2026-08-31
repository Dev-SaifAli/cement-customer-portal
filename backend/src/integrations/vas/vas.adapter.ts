import { vasConfig } from './vas.config.js';
import type {
  VasMappingIssue,
  VasMappingResult,
  VasOrderAggregate,
  VasOrderLineMappingDraft,
} from './vas.types.js';

export class VasOrderAdapter {
  map(aggregate: VasOrderAggregate): VasMappingResult {
    const hasContract = nonEmpty(aggregate.order.contractReference);
    const lines = aggregate.lines.map((line) => this.mapLine(line));
    const draft = {
      companyCode: vasConfig.companyCode,
      orderId: aggregate.order.orderNumber,
      deliveryDate: aggregate.order.deliveryDate,
      deliveryTime: aggregate.order.deliveryTime,
      remark: aggregate.order.deliveryNotes,
      customerReference: aggregate.order.customer.vasReference,
      shipToReference:
        aggregate.order.shipTo?.vasReference ?? aggregate.order.shipTo?.siteReference ?? null,
      carrierReference: aggregate.order.carrierReference,
      contractReference: aggregate.order.contractReference,
      incoterm: aggregate.order.incoterm,
      lines,
    };
    const issues: VasMappingIssue[] = [];

    required(issues, 'companyCode', draft.companyCode, 'VAS_COMPANY_CODE_REQUIRED');
    required(issues, 'orderId', draft.orderId, 'VAS_ORDER_ID_REQUIRED');
    if (lines.length === 0) {
      issues.push({
        path: 'lines',
        code: 'VAS_ORDER_LINES_REQUIRED',
        message: 'At least one order line is required.',
      });
    }

    if (!hasContract) {
      required(issues, 'customerReference', draft.customerReference, 'VAS_CUSTOMER_REQUIRED');
      required(issues, 'shipToReference', draft.shipToReference, 'VAS_SHIP_TO_REQUIRED');
      required(issues, 'incoterm', draft.incoterm, 'VAS_INCOTERM_REQUIRED');
    }

    aggregate.lines.forEach((source, index) => {
      const mapped = lines[index];
      if (!mapped) return;
      const hasContractPosition = nonEmpty(source.contractPositionReference);
      if (!hasContractPosition) {
        required(issues, `lines.${index}.material`, mapped.material, 'VAS_MATERIAL_REQUIRED');
        required(
          issues,
          `lines.${index}.shippingPointReference`,
          mapped.shippingPointReference,
          'VAS_SHIPPING_POINT_REQUIRED',
        );
        required(issues, `lines.${index}.amountUnit`, mapped.amountUnit, 'VAS_AMOUNT_UNIT_REQUIRED');
      }
      if (mapped.amount === null) {
        issues.push({
          path: `lines.${index}.amount`,
          code: 'VAS_AMOUNT_SEMANTICS_UNRESOLVED',
          message: 'The VAS meaning of Amount must be confirmed before transmission.',
        });
      }
    });

    return { draft, valid: issues.length === 0, issues };
  }

  private mapLine(line: VasOrderAggregate['lines'][number]): VasOrderLineMappingDraft {
    return {
      positionNumber: line.positionNumber,
      material: line.productCode,
      shippingPointReference: line.shippingPointReference,
      contractPositionReference: line.contractPositionReference,
      numberOfTrucks: line.numberOfTrucks,
      truckType: line.truckType,
      amount: line.vasAmount,
      amountUnit: line.vasAmountUnit,
      deliveryRemark: line.deliveryRemark,
      deliveryDate: line.deliveryDate,
      deliveryTime: line.deliveryTime,
    };
  }
}

export const vasOrderAdapter = new VasOrderAdapter();

function required(
  issues: VasMappingIssue[],
  path: string,
  value: string | number | null,
  code: string,
) {
  if (value === null || (typeof value === 'string' && value.trim().length === 0)) {
    issues.push({ path, code, message: `${path} is required for this VAS order.` });
  }
}

function nonEmpty(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}
