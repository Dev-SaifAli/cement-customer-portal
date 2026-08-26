import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QuotationDocument } from './QuotationDocument';
import type { CustomerQuotation } from '../../services/customerQuotationsService';

const quotation: CustomerQuotation = {
  id: 'quotation-1',
  reference: 'QT-2026-000123',
  status: 'DRAFT',
  fulfilmentType: 'DELIVERY',
  pickupLocationId: null,
  pickupLocation: null,
  shipToLocationId: 'location-1',
  shipToLocation: {
    id: 'location-1',
    name: 'Main Jeddah Project Site',
    siteId: 'SITE-1',
    streetAddress: 'Industrial Area',
    city: 'Jeddah',
    region: 'Makkah',
    country: 'Saudi Arabia',
    postalCode: '21442',
    contactPerson: 'Ahmed Khan',
    contactPhone: '+966501234567',
    isPrimary: true,
  },
  requestedDate: '2026-08-30',
  notes: 'Contact the site manager before arrival.',
  submittedAt: null,
  createdAt: '2026-08-24T08:00:00.000Z',
  updatedAt: '2026-08-24T08:00:00.000Z',
  validUntil: null,
  paymentTerms: null,
  commercialNotes: null,
  subtotal: null,
  vatRate: null,
  vatAmount: null,
  grandTotal: null,
  items: [
    {
      id: 'item-1',
      productId: 'product-1',
      product: {
        id: 'product-1',
        productCode: 'CEM-OPC-50KG',
        productName: 'Ordinary Portland Cement',
        description: null,
        shortDescription: null,
        image: null,
        packagingType: 'Bag',
        uom: '50KG_BAG',
        unitWeightKg: 50,
        commercialUom: 'TON',
        category: 'Cement',
      },
      packagingType: 'Bag',
      uom: '50KG_BAG',
      quantity: 2000,
      quantityTon: 100,
      packagingQuantity: 2000,
      commercialUom: 'TON',
      unitWeightKg: 50,
      equivalentTons: 100,
      palletRequired: false,
      palletType: null,
      palletQuantity: null,
      customerRate: null,
      amount: null,
    },
  ],
};

describe('QuotationDocument', () => {
  it('renders a draft quotation using persisted product data without pricing', () => {
    const { container } = render(
      <QuotationDocument
        quotation={quotation}
        account={{ id: 'account-1', companyName: 'ABC Construction Company' }}
        user={{
          id: 'user-1',
          name: 'Ahmed Khan',
          email: 'ahmed@example.com',
          role: 'CUSTOMER_ADMIN',
        }}
        phone="+966501234567"
      />,
    );

    expect(screen.getAllByText('QT-2026-000123')).toHaveLength(2);
    expect(screen.getByText('CEM-OPC-50KG')).toBeInTheDocument();
    expect(screen.getByText('Ordinary Portland Cement')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/price|margin|discount|vat|total/i);
  });
});
