export interface VasOrderAggregate {
  order: {
    id: string;
    orderNumber: string;
    deliveryDate: string | null;
    deliveryTime: string | null;
    deliveryNotes: string | null;
    contractReference: string | null;
    customer: {
      id: string;
      companyName: string;
      vasReference: string | null;
    };
    shipTo: {
      internalId: string;
      siteReference: string | null;
      vasReference: string | null;
    } | null;
    carrierReference: string | null;
    incoterm: string | null;
  };
  lines: VasOrderLineAggregate[];
}

export interface VasOrderLineAggregate {
  id: string;
  positionNumber: number | null;
  productCode: string | null;
  shippingPointReference: string | null;
  contractPositionReference: string | null;
  numberOfTrucks: number | null;
  truckType: string | null;
  vasAmount: number | null;
  vasAmountUnit: string | null;
  deliveryRemark: string | null;
  deliveryDate: string | null;
  deliveryTime: string | null;
}

/**
 * Internal mapping draft only. This is deliberately not the final VAS wire
 * payload because the external property names and identifier formats have not
 * been supplied yet.
 */
export interface VasOrderMappingDraft {
  companyCode: string | null;
  orderId: string;
  deliveryDate: string | null;
  deliveryTime: string | null;
  remark: string | null;
  customerReference: string | null;
  shipToReference: string | null;
  carrierReference: string | null;
  contractReference: string | null;
  incoterm: string | null;
  lines: VasOrderLineMappingDraft[];
}

export interface VasOrderLineMappingDraft {
  positionNumber: number | null;
  material: string | null;
  shippingPointReference: string | null;
  contractPositionReference: string | null;
  numberOfTrucks: number | null;
  truckType: string | null;
  amount: number | null;
  amountUnit: string | null;
  deliveryRemark: string | null;
  deliveryDate: string | null;
  deliveryTime: string | null;
}

export interface VasMappingIssue {
  path: string;
  code: string;
  message: string;
}

export interface VasMappingResult {
  draft: VasOrderMappingDraft;
  valid: boolean;
  issues: VasMappingIssue[];
}

export type VasOutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'VALIDATION_FAILED';

export type VasErrorCategory =
  | 'TIMEOUT'
  | 'TRANSIENT'
  | 'AUTHENTICATION'
  | 'VALIDATION'
  | 'BUSINESS'
  | 'UNKNOWN';
