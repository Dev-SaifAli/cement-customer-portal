import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Filter,
  Loader2,
  PackageOpen,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SearchableTomSelect } from '../../components/ui/SearchableTomSelect';
import {
  AdminProductsApiError,
  bulkAdminProducts,
  listAdminProducts,
  type AdminProduct,
  type ProductFilter,
} from '../../services/adminProductsService';

type BulkAction = 'ACTIVATE' | 'DEACTIVATE' | 'DELETE';
type FilterField = ProductFilter['field'];
type FieldType = 'text' | 'number' | 'select' | 'date';

interface DraftFilter {
  id: number;
  field: FilterField | '';
  condition: string;
  value: string;
  secondValue: string;
  join: 'AND' | 'OR';
}

const fields: Array<{ value: FilterField; label: string; type: FieldType }> = [
  { value: 'productCode', label: 'Product Code', type: 'text' },
  { value: 'productName', label: 'Product Name', type: 'text' },
  { value: 'packaging', label: 'Packaging', type: 'select' },
  { value: 'uom', label: 'Commercial UOM', type: 'select' },
  { value: 'status', label: 'Status', type: 'select' },
  { value: 'unitWeightKg', label: 'Unit Weight', type: 'number' },
  { value: 'updatedAt', label: 'Last Updated', type: 'date' },
];

const operators: Record<FieldType, Array<[string, string]>> = {
  text: [
    ['equals', 'Equals'],
    ['notEquals', 'Not Equals'],
    ['contains', 'Contains'],
    ['startsWith', 'Starts With'],
    ['endsWith', 'Ends With'],
  ],
  number: [
    ['equals', 'Equals'],
    ['notEquals', 'Not Equals'],
    ['greaterThan', 'Greater Than'],
    ['greaterThanOrEqual', 'Greater Than or Equal'],
    ['lessThan', 'Less Than'],
    ['lessThanOrEqual', 'Less Than or Equal'],
    ['between', 'Between'],
  ],
  date: [
    ['equals', 'Equals'],
    ['before', 'Before'],
    ['after', 'After'],
    ['between', 'Between'],
  ],
  select: [
    ['equals', 'Equals'],
    ['notEquals', 'Not Equals'],
    ['in', 'In'],
  ],
};

const selectValues: Partial<Record<FilterField, string[]>> = {
  packaging: ['Bag', 'Bulk'],
  uom: ['TON', '50KG_BAG', '40KG_BAG'],
  status: ['Active', 'Inactive'],
};

const filterFieldOptions = fields.map(({ value, label }) => ({ value, label }));

export function AdminProducts() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<DraftFilter[]>([]);
  const [activeFilters, setActiveFilters] = useState<DraftFilter[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [pricePopover, setPricePopover] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const filterSequence = useRef(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await listAdminProducts({
        page,
        pageSize,
        search: debouncedSearch || undefined,
        filters: activeFilters.map(toApiFilter),
      });
      setProducts(result.products);
      setTotal(result.pagination.total);
      setSelected(new Set());
      setPricePopover(null);
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setLoading(false);
    }
  }, [activeFilters, debouncedSearch, page]);

  useEffect(() => void load(), [load]);

  const createFilter = useCallback(() => {
    const id = filterSequence.current++;
    return {
      id,
      field: '' as const,
      condition: '',
      value: '',
      secondValue: '',
      join: 'AND' as const,
    };
  }, []);

  const openFilters = () => {
    setDraftFilters([createFilter()]);
    setFiltersOpen(true);
  };

  const applyFilters = () => {
    setActiveFilters(draftFilters.filter(hasFilterValue));
    setFiltersOpen(false);
    setPage(1);
  };

  const addDraftFilter = () => {
    setDraftFilters((current) => [...current, createFilter()]);
  };

  const clearDraftFilters = () => {
    setDraftFilters([createFilter()]);
    setActiveFilters([]);
    setPage(1);
  };

  const removeFilter = (id: number) => {
    setActiveFilters((current) => current.filter((item) => item.id !== id));
    setDraftFilters((current) => current.filter((item) => item.id !== id));
    setPage(1);
  };

  const clearFilters = () => {
    setActiveFilters([]);
    setPage(1);
  };

  const act = async (action: BulkAction) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (
      action === 'DELETE' &&
      !window.confirm(
        `Delete ${ids.length} selected product${ids.length === 1 ? '' : 's'}? Referenced products will be safely made inactive so historical records remain available.`,
      )
    ) {
      return;
    }
    if (
      action === 'DEACTIVATE' &&
      !window.confirm(
        `Deactivate ${ids.length} selected product${ids.length === 1 ? '' : 's'}? They will no longer be available for new customer quotations and orders.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    setMenuOpen(false);
    try {
      await bulkAdminProducts(ids, action);
      await load();
    } catch (failure) {
      setError(safeError(failure));
    } finally {
      setBusy(false);
    }
  };

  const allVisibleSelected =
    products.length > 0 && products.every((product) => selected.has(product.id));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="customer-muted text-xs">
        <span className="customer-primary font-semibold">Products</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="customer-text text-2xl font-bold">Products</h1>
          <p className="customer-muted mt-1 text-sm">
            Manage products, packaging, units and product pricing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openFilters}
            className={secondaryButton}
          >
            <Filter size={15} />
            Filter
            {activeFilters.length ? <Counter>{activeFilters.length}</Counter> : null}
          </button>
          <Link to="/admin/products/create" className={primaryButton}>
            <Plus size={16} /> New Product
          </Link>
          <div className="relative">
            <button
              type="button"
              aria-label="Product actions"
              onClick={() => setMenuOpen((value) => !value)}
              className={iconButton}
            >
              <EllipsisVertical size={18} />
            </button>
            {menuOpen && (
              <ActionMenu
                count={selected.size}
                edit={() => {
                  const id = Array.from(selected)[0];
                  if (id) navigate(`/admin/products/${id}`);
                  setMenuOpen(false);
                }}
                act={act}
              />
            )}
          </div>
        </div>
      </div>

      {error && <Message error>{error}</Message>}

      <section className="customer-card overflow-visible rounded-xl border">
        <div className="customer-border-soft flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search
              size={15}
              className="customer-muted absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              aria-label="Search Product or Code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${input} pl-9`}
              placeholder="Search product or code"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="customer-muted text-xs font-semibold">{total} Products</span>
            {(activeFilters.length > 0 || search) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  clearFilters();
                }}
                className={textButton}
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="customer-border-soft flex flex-wrap gap-1.5 border-b px-3 py-2">
            {activeFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => removeFilter(filter.id)}
                className="customer-primary-soft customer-primary inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
              >
                {fieldLabel(filter.field)}: {formatFilterValue(filter)}
                <X size={12} />
              </button>
            ))}
          </div>
        )}

        {selected.size > 0 && (
          <div className="customer-primary-soft customer-primary customer-border-soft flex items-center justify-between border-b px-3 py-2 text-xs font-semibold">
            <span>{selected.size} selected</span>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <X size={13} /> Clear selection
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1260px] text-sm">
            <thead className="customer-surface-secondary customer-secondary text-left text-xs">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input
                    aria-label="Select all visible products"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={() => {
                      const next = new Set(selected);
                      products.forEach((product) =>
                        allVisibleSelected ? next.delete(product.id) : next.add(product.id),
                      );
                      setSelected(next);
                    }}
                    className={checkbox}
                  />
                </th>
                <th className="w-14 px-2 py-2.5">S.No.</th>
                <th className={cell}>Product Code</th>
                <th className={cell}>Product Name</th>
                <th className={cell}>Packaging</th>
                <th className={cell}>Bag Size</th>
                <th className={cell}>Unit Weight</th>
                <th className={cell}>Commercial UOM</th>
                <th className={cell}>Prices (SAR/TON)</th>
                <th className={cell}>Status</th>
                <th className={cell}>Last Updated</th>
                <th className={cell}>Updated By</th>
              </tr>
            </thead>
            <tbody className="customer-border-soft divide-y">
              {loading ? (
                <SkeletonRows />
              ) : products.length ? (
                products.map((product, index) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    index={(page - 1) * pageSize + index + 1}
                    selected={selected.has(product.id)}
                    toggle={() => setSelected(toggle(selected, product.id))}
                    pricePopover={pricePopover}
                    setPricePopover={setPricePopover}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={12} className="p-12 text-center">
                    <PackageOpen className="customer-muted mx-auto mb-3" />
                    <p className="customer-text font-semibold">No products found</p>
                    <p className="customer-muted mt-1 text-sm">
                      Adjust the search or filters, or create a new product.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="customer-border-soft flex flex-col gap-2 border-t px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <span className="customer-muted">
            Showing {total ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, total)} of{' '}
            {total}
          </span>
          <div className="flex items-center gap-1">
            <button className={pageButton} disabled={page === 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="customer-primary-soft customer-primary flex h-8 min-w-8 items-center justify-center rounded-md font-bold">
              {page}
            </span>
            <span className="customer-muted px-1">of {pageCount}</span>
            <button
              className={pageButton}
              disabled={page === pageCount}
              onClick={() => setPage(page + 1)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {filtersOpen && (
        <FilterDrawer
          filters={draftFilters.length ? draftFilters : [createFilter()]}
          setFilters={setDraftFilters}
          addFilter={addDraftFilter}
          clear={clearDraftFilters}
          apply={applyFilters}
          close={() => setFiltersOpen(false)}
        />
      )}

      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <div className="customer-card flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold">
            <Loader2 size={17} className="customer-primary animate-spin" /> Updating products...
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRow({
  product,
  index,
  selected,
  toggle: toggleRow,
  pricePopover,
  setPricePopover,
}: {
  product: AdminProduct;
  index: number;
  selected: boolean;
  toggle: () => void;
  pricePopover: string | null;
  setPricePopover: (id: string | null) => void;
}) {
  const open = pricePopover === product.id;
  const prices = product.priceSummary.prices;
  const visiblePrices = prices.slice(0, 3);
  const remainingPrices = Math.max(0, prices.length - visiblePrices.length);
  return (
    <tr className="customer-text transition-colors hover:bg-[var(--customer-surface-secondary)]">
      <td className={cell}>
        <input
          aria-label={`Select ${product.productCode}`}
          type="checkbox"
          checked={selected}
          onChange={toggleRow}
          className={checkbox}
        />
      </td>
      <td className={`${cell} customer-muted text-xs`}>{index}</td>
      <td className={cell}>
        <Link
          to={`/admin/products/${product.id}`}
          className="customer-primary font-semibold hover:underline"
        >
          {product.productCode}
        </Link>
      </td>
      <td className={cell}>
        <Link
          to={`/admin/products/${product.id}`}
          className="font-semibold hover:text-[var(--customer-primary)]"
        >
          {product.productName}
        </Link>
      </td>
      <td className={cell}>{product.packaging}</td>
      <td className={cell}>{isBag(product) ? `${number(product.unitWeightKg)} KG` : '-'}</td>
      <td className={cell}>{number(product.unitWeightKg)} KG</td>
      <td className={cell}>TON</td>
      <td className={`${cell} relative min-w-[190px] align-top`}>
        {visiblePrices.length ? (
          <div className="space-y-1.5 text-xs">
            {visiblePrices.map((price) => (
              <div key={price.city} className="flex items-baseline justify-between gap-3">
                <span className="customer-secondary min-w-0 truncate" title={price.city}>
                  {price.city}
                </span>
                <strong className="customer-text whitespace-nowrap font-semibold">
                  {money(price.listPrice)} {prices.length === 1 ? 'SAR/TON' : 'SAR'}
                </strong>
              </div>
            ))}
            {remainingPrices > 0 && (
              <button
                type="button"
                onClick={() => setPricePopover(open ? null : product.id)}
                className="customer-primary text-xs font-semibold hover:underline"
                aria-expanded={open}
                aria-label={`Show all prices for ${product.productName}`}
              >
                + {remainingPrices} more
              </button>
            )}
          </div>
        ) : (
          <span className="customer-muted text-xs">No configured prices</span>
        )}
        {open && (
          <div className="customer-card absolute left-3 top-full z-30 mt-2 w-72 rounded-lg border p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <p className="customer-text text-sm font-bold">Product Prices</p>
              <button
                type="button"
                onClick={() => setPricePopover(null)}
                className="customer-secondary rounded-md p-1 hover:bg-[var(--customer-surface-secondary)]"
                aria-label="Close prices"
              >
                <X size={14} />
              </button>
            </div>
            {prices.length ? (
              <div className="space-y-1.5">
                {prices.map((price) => (
                  <div key={price.city} className="flex items-center justify-between text-xs">
                    <span className="customer-secondary">{price.city}</span>
                    <strong className="customer-text">{money(price.listPrice)} SAR/TON</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="customer-muted text-xs">No configured city prices.</p>
            )}
          </div>
        )}
      </td>
      <td className={cell}>
        <Status active={product.isActive} />
      </td>
      <td className={`${cell} customer-muted whitespace-nowrap text-xs`}>
        {dateTime(product.updatedAt)}
      </td>
      <td className={cell}>{product.updatedBy}</td>
    </tr>
  );
}

function FilterDrawer({ filters, setFilters, addFilter, clear, apply, close }: {
  filters: DraftFilter[];
  setFilters: Dispatch<SetStateAction<DraftFilter[]>>;
  addFilter: () => void;
  clear: () => void;
  apply: () => void;
  close: () => void;
}) {
  const update = (id: number, patch: Partial<DraftFilter>) =>
    setFilters((current) =>
      current.map((filter) => (filter.id === id ? { ...filter, ...patch } : filter)),
    );
  const remove = (id: number) =>
    setFilters((current) => current.filter((filter) => filter.id !== id));
  const completeFilters = filters.filter(hasFilterValue).length;
  const allFiltersComplete = filters.length > 0 && filters.every(hasFilterValue);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-3 backdrop-blur-[1px] sm:p-5"
      onMouseDown={close}
    >
      <aside
        className="products-filter-popup customer-card relative flex max-h-[calc(100vh-1.5rem)] w-full max-w-[640px] flex-col overflow-visible rounded-xl border shadow-xl sm:max-h-[calc(100vh-2.5rem)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="products-filter-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="customer-border-soft flex items-center justify-between border-b px-4 py-3.5 sm:px-5">
          <div>
            <h2 id="products-filter-title" className="customer-text text-base font-bold">
              Filter Products
            </h2>
            <p className="customer-muted mt-1 text-xs">Choose field, condition and value.</p>
          </div>
          <button type="button" onClick={close} className={iconButton} aria-label="Close filters">
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5 sm:px-5">
          <div className="space-y-3">
            {filters.map((filter, index) => (
              <div key={filter.id}>
                {index > 0 && (
                  <div className="mb-2 flex items-center gap-3">
                    <span className="customer-border-soft h-px flex-1 border-t" />
                    <select
                      aria-label={`Logical operator for filter ${index + 1}`}
                      className={`${filterInput} w-20 flex-none font-semibold`}
                      value={filter.join}
                      onChange={(event) =>
                        update(filter.id, { join: event.target.value as 'AND' | 'OR' })
                      }
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                    <span className="customer-border-soft h-px flex-1 border-t" />
                  </div>
                )}
                <FilterRow
                  filter={filter}
                  update={(patch) => update(filter.id, patch)}
                  {...(filters.length > 1 ? { remove: () => remove(filter.id) } : {})}
                />
              </div>
            ))}
          </div>

          {allFiltersComplete && (
            <button type="button" onClick={addFilter} className={`${textButton} mt-3`}>
              <Plus size={14} /> Add Filter
            </button>
          )}
        </div>

        <div className="customer-card customer-border-soft flex items-center justify-between gap-2 rounded-b-xl border-t px-4 py-3 sm:px-5">
          <button type="button" onClick={clear} className={secondaryButton}>
            Clear
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!allFiltersComplete}
            className={primaryButton}
          >
            Apply Filters{completeFilters ? ` (${completeFilters})` : ''}
          </button>
        </div>
      </aside>
    </div>
  );
}

function FilterRow({ filter, update, remove }: {
  filter: DraftFilter;
  update: (patch: Partial<DraftFilter>) => void;
  remove?: () => void;
}) {
  const definition = fields.find((field) => field.value === filter.field);
  const fieldOperators = definition ? operators[definition.type] : [];
  const between = filter.condition === 'between';

  return (
    <div className="customer-surface-secondary rounded-lg p-3">
      <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1.25fr_auto]">
        <label className="block min-w-0">
          <span className="customer-secondary mb-1.5 block text-xs font-semibold">Field</span>
          <SearchableTomSelect
            ariaLabel="Filter field"
            placeholder="Select field"
            value={filter.field}
            options={filterFieldOptions}
            dropdownParent="body"
            onChange={(value) => {
              const field = value as FilterField | '';
              update({ field, condition: '', value: '', secondValue: '' });
            }}
          />
        </label>

        <label className="block min-w-0">
          <span className="customer-secondary mb-1.5 block text-xs font-semibold">Condition</span>
          <SearchableTomSelect
            ariaLabel="Filter condition"
            placeholder="Select condition"
            value={filter.condition}
            disabled={!definition}
            dropdownParent="body"
            options={fieldOperators.map(([value, label]) => ({ value, label }))}
            onChange={(condition) => update({ condition, value: '', secondValue: '' })}
          />
        </label>

        <div className="min-w-0">
          <span className="customer-secondary mb-1.5 block text-xs font-semibold">Value</span>
          <div className={between ? 'grid gap-2 sm:grid-cols-2' : ''}>
            <FilterValue
              filter={filter}
              update={update}
              valueKey="value"
              {...(definition ? { definition } : {})}
            />
            {between && (
              <FilterValue
                filter={filter}
                update={update}
                valueKey="secondValue"
                {...(definition ? { definition } : {})}
              />
            )}
          </div>
        </div>

        <button
          type="button"
          aria-label="Remove filter"
          title="Remove filter"
          disabled={!remove}
          onClick={remove}
          className={`${iconButton} disabled:cursor-not-allowed disabled:opacity-35`}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

function FilterValue({
  filter,
  definition,
  update,
  valueKey,
}: {
  filter: DraftFilter;
  definition?: { value: FilterField; label: string; type: FieldType };
  update: (patch: Partial<DraftFilter>) => void;
  valueKey: 'value' | 'secondValue';
}) {
  const setValue = (value: string) => {
    update(valueKey === 'value' ? { value } : { secondValue: value });
  };

  const disabled = !definition || !filter.condition;

  if (definition?.type === 'select') {
    return (
      <SearchableTomSelect
        ariaLabel="Filter value"
        placeholder={`Select ${definition.label.toLowerCase()}`}
        value={filter[valueKey]}
        disabled={disabled}
        dropdownParent="body"
        options={(selectValues[definition.value] ?? []).map((value) => ({ value, label: value }))}
        onChange={setValue}
      />
    );
  }

  return (
    <input
      aria-label="Filter value"
      type={definition?.type === 'date' ? 'date' : definition?.type === 'number' ? 'number' : 'text'}
      className={filterInput}
      value={filter[valueKey]}
      disabled={disabled}
      onChange={(event) => setValue(event.target.value)}
      placeholder={disabled ? 'Select field and condition' : 'Enter value'}
    />
  );
}

function ActionMenu({
  count,
  edit,
  act,
}: {
  count: number;
  edit: () => void;
  act: (action: BulkAction) => void;
}) {
  return (
    <div className="customer-card absolute right-0 top-11 z-20 w-48 rounded-lg border p-1.5 text-sm shadow-lg">
      <button disabled={count !== 1} onClick={edit} className={menuItem}>
        Edit
      </button>
      <button
        disabled={!count}
        onClick={() => void act('ACTIVATE')}
        className={`${menuItem} text-[#0f8b5f]`}
      >
        Activate
      </button>
      <button
        disabled={!count}
        onClick={() => void act('DEACTIVATE')}
        className={`${menuItem} text-[#b45309]`}
      >
        Deactivate
      </button>
      <button
        disabled={!count}
        onClick={() => void act('DELETE')}
        className={`${menuItem} text-[#b42318]`}
      >
        Delete
      </button>
    </div>
  );
}

function Status({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
        active ? 'text-[var(--customer-success)]' : 'customer-muted'
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          active ? 'bg-[var(--customer-success)]' : 'bg-slate-400'
        }`}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index}>
          <td colSpan={12} className="px-3 py-3">
            <div className="customer-surface-secondary h-5 animate-pulse rounded" />
          </td>
        </tr>
      ))}
    </>
  );
}

function Message({ error, children }: { error?: boolean; children: ReactNode }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
        error
          ? 'border-red-200 bg-red-50 text-[#b42318]'
          : 'border-emerald-200 bg-emerald-50 text-[#0f8b5f]'
      }`}
    >
      {children}
    </div>
  );
}

function toApiFilter(filter: DraftFilter): ProductFilter {
  const value =
    filter.condition === 'between'
      ? [filter.value, filter.secondValue]
      : filter.condition === 'in'
        ? filter.value.split(',').map((item) => item.trim()).filter(Boolean)
        : filter.value;
  if (!filter.field) throw new Error('A filter field is required.');
  return { field: filter.field, condition: filter.condition, value, join: filter.join };
}

function hasFilterValue(filter: DraftFilter) {
  if (!filter.field || !filter.condition) return false;
  return Boolean(
    filter.condition === 'between'
      ? filter.value.trim() && filter.secondValue.trim()
      : filter.value.trim(),
  );
}

function safeError(error: unknown) {
  return error instanceof AdminProductsApiError ? error.message : 'Unable to load products.';
}
function toggle(current: Set<string>, id: string) {
  const next = new Set(current);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}
function fieldLabel(field: FilterField | '') {
  return fields.find((item) => item.value === field)?.label ?? field;
}
function formatFilterValue(filter: DraftFilter) {
  return filter.condition === 'between' ? `${filter.value} - ${filter.secondValue}` : filter.value;
}
function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-SA', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}
function number(value: number) {
  return new Intl.NumberFormat('en-SA', { maximumFractionDigits: 3 }).format(value);
}
function money(value: number) {
  return new Intl.NumberFormat('en-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
function isBag(product: AdminProduct) {
  return product.packaging.toLowerCase().includes('bag');
}

function Counter({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--customer-primary)] px-1.5 py-0.5 text-[10px] text-white">
      {children}
    </span>
  );
}

const input =
  'customer-input customer-border customer-text h-10 w-full rounded-lg border px-3 text-sm outline-none transition placeholder:text-[var(--customer-text-muted)] focus:border-[var(--customer-primary)] focus:ring-2 focus:ring-[var(--customer-primary-soft)]';
const filterInput =
  'customer-input customer-border customer-text h-9 w-full rounded-md border px-2.5 text-xs outline-none transition focus:border-[var(--customer-primary)]';
const primaryButton =
  'customer-primary-bg inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButton =
  'customer-surface customer-border customer-secondary inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-xs font-semibold transition hover:bg-[var(--customer-surface-secondary)] hover:text-[var(--customer-primary)]';
const textButton =
  'customer-primary inline-flex h-9 items-center gap-1.5 px-2 text-xs font-semibold hover:underline';
const iconButton =
  'customer-surface customer-border customer-secondary inline-flex h-10 w-10 items-center justify-center rounded-lg border transition hover:bg-[var(--customer-primary-soft)] hover:text-[var(--customer-primary)]';
const menuItem =
  'block w-full rounded-md px-3 py-2 text-left font-semibold hover:bg-[var(--customer-surface-secondary)] disabled:cursor-not-allowed disabled:opacity-35';
const checkbox = 'h-4 w-4 rounded border-[#cbd5e1] accent-[#54247a]';
const cell = 'px-3 py-2.5';
const pageButton =
  'customer-surface customer-border customer-text inline-flex h-8 items-center gap-1 rounded-md border px-2 font-semibold disabled:opacity-40';
