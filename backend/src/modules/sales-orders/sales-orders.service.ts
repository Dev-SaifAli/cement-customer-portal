import { AppError } from '../../errors/app-error.js';
import { ordersRepository } from '../customer-orders/orders.repository.js';
import type { ListSalesOrdersQuery } from './sales-orders.validation.js';

export class SalesOrdersService {
  async list(query: ListSalesOrdersQuery) {
    return ordersRepository.list({}, query);
  }

  async getById(id: string) {
    const order = await ordersRepository.getById(id, {});
    if (!order) throw new AppError('Order was not found.', 404, 'SALES_ORDER_NOT_FOUND');
    return order;
  }
}

export const salesOrdersService = new SalesOrdersService();
