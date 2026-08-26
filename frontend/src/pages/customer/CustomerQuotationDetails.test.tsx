import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CustomerQuotation } from '../../services/customerQuotationsService';
import { CustomerQuotationDetails } from './CustomerQuotationDetails';

const { acceptCustomerQuotation } = vi.hoisted(() => ({ acceptCustomerQuotation: vi.fn() }));

vi.mock('../../context/CustomerAuthContext', () => ({
  useCustomerAuth: () => ({
    account: { id: 'account-1', companyName: 'Ali Brothers' },
    user: {
      id: 'user-1',
      name: 'Saif Ali',
      email: 'saif@example.com',
      role: 'CUSTOMER_ADMIN',
    },
  }),
}));

vi.mock('../../services/customerDashboardService', () => ({
  getCustomerDashboard: vi.fn().mockResolvedValue({
    contact: { phone: '+966555000111' },
    administrator: { phone: '+966555000111' },
  }),
}));

vi.mock('../../services/customerQuotationsService', async () => {
  const actual = await vi.importActual('../../services/customerQuotationsService');
  return {
    ...actual,
    acceptCustomerQuotation,
    rejectCustomerQuotation: vi.fn(),
    requestCustomerQuotationClarification: vi.fn(),
  };
});

describe('CustomerQuotationDetails', () => {
  beforeEach(() => {
    acceptCustomerQuotation.mockReset();
    acceptCustomerQuotation.mockResolvedValue({ ...quotation, status: 'ACCEPTED' });
  });

  it('shows only approved customer-facing pricing and records acceptance after confirmation', async () => {
    render(
      <MemoryRouter>
        <CustomerQuotationDetails initialQuotation={quotation} />
      </MemoryRouter>,
    );

    expect(screen.getByText('175.00')).toBeInTheDocument();
    expect(screen.getByText('1,750.00')).toBeInTheDocument();
    expect(screen.getByText('2,012.50 SAR')).toBeInTheDocument();
    expect(screen.queryByText(/Product Price/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Delivery Price/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Approval Routing/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Accept Quotation/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => expect(acceptCustomerQuotation).toHaveBeenCalledWith(quotation.id));
    expect(await screen.findByText('Quotation accepted successfully.')).toBeInTheDocument();
  });
});

const quotation: CustomerQuotation = {
  id: 'quotation-1',
  reference: 'QT-2026-000123',
  status: 'READY_FOR_CUSTOMER',
  fulfilmentType: 'DELIVERY',
  pickupLocationId: null,
  pickupLocation: null,
  shipToLocationId: 'site-1',
  shipToLocation: {
    id: 'site-1',
    name: 'Main Jeddah Project Site',
    siteId: 'SITE-1',
    streetAddress: 'Industrial Area',
    city: 'Jeddah',
    region: 'Makkah',
    country: 'Saudi Arabia',
    postalCode: '21442',
    contactPerson: 'Site Manager',
    contactPhone: '+966555000222',
    isPrimary: true,
  },
  requestedDate: '2026-08-30',
  notes: 'Please confirm delivery.',
  submittedAt: '2026-08-24T08:00:00.000Z',
  createdAt: '2026-08-24T08:00:00.000Z',
  updatedAt: '2026-08-24T09:00:00.000Z',
  validUntil: '2026-09-07',
  paymentTerms: '30 Days From Invoice Date',
  commercialNotes: 'Prices are firm until the validity date.',
  subtotal: 1750,
  vatRate: 0.15,
  vatAmount: 262.5,
  grandTotal: 2012.5,
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
        uom: 'TON',
        unitWeightKg: 1000,
        commercialUom: 'TON',
        category: 'Cement',
      },
      packagingType: 'Bag',
      uom: 'TON',
      quantity: 10,
      quantityTon: 10,
      packagingQuantity: null,
      commercialUom: 'TON',
      unitWeightKg: 1000,
      equivalentTons: 10,
      palletRequired: false,
      palletType: null,
      palletQuantity: null,
      customerRate: 175,
      amount: 1750,
    },
  ],
};
