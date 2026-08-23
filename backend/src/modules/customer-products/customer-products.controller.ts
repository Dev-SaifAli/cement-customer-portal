import type { Response } from 'express';
import type { CustomerAuthenticatedRequest } from '../customer-auth/customer-auth.types.js';
import { customerProductsService } from './customer-products.service.js';
import {
  customerProductIdSchema,
  listCustomerProductsSchema,
} from './customer-products.validation.js';

export class CustomerProductsController {
  async show(request: CustomerAuthenticatedRequest, response: Response) {
    const productId = customerProductIdSchema.parse(request.params.id);
    const product = await customerProductsService.getProduct(productId);

    response.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  }

  async list(request: CustomerAuthenticatedRequest, response: Response) {
    const query = listCustomerProductsSchema.parse(request.query);
    const products = await customerProductsService.listProducts(query);

    response.status(200).json({
      success: true,
      data: products,
    });
  }
}

export const customerProductsController = new CustomerProductsController();
