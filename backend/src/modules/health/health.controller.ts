import type { RequestHandler } from 'express';
import { HealthService } from './health.service.js';

const healthService = new HealthService();

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json(healthService.getStatus());
};
