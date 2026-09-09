import { ListPageHeader } from '../list/ListPageHeader';

export function CustomerListPageHeader({
  title,
  createAction,
}: {
  title: string;
  createAction?: { label: string; to: string };
}) {
  return (
    <ListPageHeader
      rootLabel="Customer"
      rootTo="/customer/dashboard"
      title={title}
      {...(createAction ? { createAction } : {})}
    />
  );
}
