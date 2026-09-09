export function getOperationalPortalPresentation(role: string | undefined) {
  const isDispatch = role === 'DISPATCH_USER';
  return {
    isDispatch,
    basePath: isDispatch ? '/dispatch' : '/hader',
    portalLabel: isDispatch ? 'Dispatch Team' : 'Hader Team',
    contractsLabel: isDispatch ? 'Pickup Contracts' : 'Delivery Contracts',
    ordersLabel: isDispatch ? 'Pickup Orders' : 'Delivery Orders',
  };
}
