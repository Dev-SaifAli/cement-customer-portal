import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerQuotations } from './CustomerQuotations';
import { listCustomerQuotations } from '../../services/customerQuotationsService';

vi.mock('../../services/customerQuotationsService', () => ({
  listCustomerQuotations: vi.fn(),
}));

const listMock = vi.mocked(listCustomerQuotations);

describe('CustomerQuotations', () => {
  beforeEach(() => {
    listMock.mockResolvedValue({
      items: [
        {
          id: 'quotation-1',
          reference: 'QT-2026-000123',
          status: 'PENDING_SALES_REVIEW',
          fulfilmentType: 'DELIVERY',
          deliveryLocation: 'Main Jeddah Project Site',
          requestedDate: '2026-08-30',
          itemCount: 3,
          submittedAt: '2026-08-24T09:00:00.000Z',
          createdAt: '2026-08-24T08:00:00.000Z',
          updatedAt: '2026-08-24T09:00:00.000Z',
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  it('renders a customer-scoped quotation summary and row selection', async () => {
    render(
      <MemoryRouter>
        <CustomerQuotations />
      </MemoryRouter>,
    );

    const referenceLinks = await screen.findAllByText('QT-2026-000123');
    expect(referenceLinks[0]).toHaveAttribute('href', '/customer/quotations/quotation-1');
    expect(screen.getAllByText('3 Items').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pending Sales Review').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByLabelText('Select QT-2026-000123')[0]!);
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });
});
