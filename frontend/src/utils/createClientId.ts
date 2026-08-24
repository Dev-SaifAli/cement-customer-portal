import { v4 as uuidv4 } from 'uuid';

let fallbackCounter = 0;

export const createClientId = () => {
  try {
    return uuidv4();
  } catch {
    fallbackCounter += 1;
    return `client-${Date.now().toString(36)}-${fallbackCounter.toString(36)}`;
  }
};
