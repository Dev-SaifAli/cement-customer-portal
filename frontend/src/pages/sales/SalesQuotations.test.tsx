import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const { listSalesQuotations, useSalesAuth } = vi.hoisted(() => ({
  listSalesQuotations: vi.fn(),
  useSalesAuth: vi.fn(() => ({
    user: {
      id: 'sales-1',
      name: 'Sales User',
      email: 'sales@example.com',
      isActive: true,
      role: 'SALES_REP',
    },
  })),
}));
vi.mock('../../services/salesService', () => ({ listSalesQuotations }));
vi.mock('../../context/SalesAuthContext', () => ({ useSalesAuth }));

import { SalesQuotationsPage } from './SalesQuotations';

describe('SalesQuotationsPage', () => {
  it('renders customer quotation summaries and row selection without an action column', async () => {
    listSalesQuotations.mockResolvedValue({
      items: [
        {
          id: 'quote-1',
          reference: 'QT-2026-000123',
          customer: 'ABC Construction',
          submittedAt: '2026-08-24T08:00:00.000Z',
          itemCount: 2,
          fulfilmentType: 'DELIVERY',
          total: 1150,
          status: 'PENDING_SALES_REVIEW',
        },
      ],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(
      <MemoryRouter initialEntries={['/sales/quotations']}>
        <SalesQuotationsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'QT-2026-000123' })).toHaveAttribute(
      'href',
      '/sales/quotations/quote-1',
    );
    expect(screen.getAllByText('ABC Construction').length).toBeGreaterThan(0);
    expect(screen.queryByText('View')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select QT-2026-000123' }));
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
    await waitFor(() =>
      expect(listSalesQuotations).toHaveBeenCalledWith(expect.objectContaining({ page: 1 })),
    );
  });
});
