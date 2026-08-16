export interface HealthStatus {
  success: true;
  message: 'API is running';
}

export class HealthService {
  getStatus(): HealthStatus {
    return { success: true, message: 'API is running' };
  }
}
