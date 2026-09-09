export function isAbortError(cause: unknown) {
  return cause instanceof DOMException && cause.name === 'AbortError';
}
