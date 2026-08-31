const ignoredPaths = [
  '/auth/',
  '/notifications/',
  '/captcha',
  '/registrations/cities',
];

type FeedbackWindow = Window & {
  __alsafwaOperationFeedbackInstalled?: boolean;
  __alsafwaOriginalFetch?: typeof window.fetch;
};

const recentlyShown = new Map<string, number>();

export function installOperationFeedback() {
  const feedbackWindow = window as FeedbackWindow;
  if (feedbackWindow.__alsafwaOperationFeedbackInstalled) return;
  feedbackWindow.__alsafwaOperationFeedbackInstalled = true;
  feedbackWindow.__alsafwaOriginalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const response = await feedbackWindow.__alsafwaOriginalFetch!(input, init);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    const message = response.ok ? feedbackMessage(method, url.pathname) : null;
    if (message) publishOnce(message);
    return response;
  };

}

function feedbackMessage(method: string, path: string) {
  if (ignoredPaths.some((entry) => path.includes(entry))) return null;
  if (path.endsWith('/read') || path.endsWith('/read-all')) return null;
  if (path.includes('/registrations/') && !path.endsWith('/submit')) return null;
  if (path.endsWith('/price') || path.endsWith('/calculate') || path.endsWith('/validate')) return null;
  if (path.endsWith('/submit')) return 'Submitted successfully.';
  if (path.endsWith('/approve')) return 'Approved successfully.';
  if (path.endsWith('/reject')) return 'Rejected successfully.';
  if (path.endsWith('/activate')) return 'Activated successfully.';
  if (path.endsWith('/deactivate')) return 'Deactivated successfully.';
  if (path.endsWith('/start-processing')) return 'Order processing started successfully.';
  if (path.endsWith('/start-review')) return 'Review started successfully.';
  if (method === 'DELETE') return 'Deleted successfully.';
  if (method === 'PATCH' || method === 'PUT') return 'Changes saved successfully.';
  if (method === 'POST' && !path.includes('/pricing') && !path.includes('/preview')) return 'Created successfully.';
  return null;
}

function publishOnce(message: string) {
  const now = Date.now();
  if (now - (recentlyShown.get(message) ?? 0) < 1200) return;
  recentlyShown.set(message, now);
  window.dispatchEvent(new CustomEvent('alsafwa:operation-success', { detail: message }));
}
