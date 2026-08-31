import { env } from '../../config/env.js';

interface VasAuthenticationConfiguration {
  mechanism: string | null;
}

const authentication: VasAuthenticationConfiguration = { mechanism: null };

export const vasConfig = Object.freeze({
  enabled: env.VAS_ENABLED,
  baseUrl: env.VAS_BASE_URL ?? null,
  orderEndpoint: env.VAS_ORDER_ENDPOINT ?? null,
  companyCode: env.VAS_COMPANY_CODE ?? null,
  timeoutMs: env.VAS_TIMEOUT_MS ?? null,
  authentication,
});

export const isVasTransmissionConfigured = () =>
  vasConfig.enabled &&
  vasConfig.baseUrl !== null &&
  vasConfig.orderEndpoint !== null &&
  vasConfig.companyCode !== null &&
  vasConfig.timeoutMs !== null &&
  vasConfig.authentication.mechanism !== null;
