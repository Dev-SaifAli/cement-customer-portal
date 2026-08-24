import {
  AlertCircle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  RefreshCw,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ProductImage } from '../../components/customer/ProductImage';
import {
  getCustomerProducts,
  type CustomerProduct,
  type CustomerProductsResult,
} from '../../services/customerProductsService';

type ProductFilters = {
  search: string;
  category: string;
  packagingType: string;
  uom: string;
};

const initialFilters: ProductFilters = {
  search: '',
  category: '',
  packagingType: '',
  uom: '',
};

export function CustomerProducts() {
  const [productsResult, setProductsResult] = useState<CustomerProductsResult | null>(null);
  const [filters, setFilters] = useState<ProductFilters>(initialFilters);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const products = productsResult?.items ?? [];
  const pagination = productsResult?.pagination;

  const filterOptions = useMemo(() => {
    const categories = new Set<string>();
    const packagingTypes = new Set<string>();
    const uoms = new Set<string>();

    products.forEach((product) => {
      categories.add(product.category);
      packagingTypes.add(product.packagingType);
      uoms.add(product.uom);
    });

    return {
      categories: Array.from(categories).sort(),
      packagingTypes: Array.from(packagingTypes).sort(),
      uoms: Array.from(uoms).sort(),
    };
  }, [products]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setProductsResult(await getCustomerProducts({ ...filters, page }));
    } catch {
      setError('We could not load the product catalog. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const updateFilter = (field: keyof ProductFilters, value: string) => {
    setPage(1);
    setFilters((current) => ({ ...current, [field]: value }));
  };

  const resetFilters = () => {
    setPage(1);
    setFilters(initialFilters);
  };

  const totalProducts = pagination?.total ?? 0;
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const currentPage = pagination?.page ?? page;
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7c3b7e]">
            Customer Portal
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Product Catalog</h1>
          <p className="mt-1 max-w-2xl text-sm font-medium text-slate-500">
            Browse active AlSafwa Cement products available in the portal catalog.
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Boxes className="h-4 w-4 text-[#54247a]" />
            <span>10 products per page</span>
          </div>
          <p className="text-sm font-bold text-slate-700">
            {totalProducts} {totalProducts === 1 ? 'Product' : 'Products'}
          </p>
        </div>

        <div className="grid gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <FilterInput
            value={filters.search}
            placeholder="Product name or code"
            onChange={(value) => updateFilter('search', value)}
          />
          <FilterSelect
            value={filters.category}
            placeholder="Category"
            options={filterOptions.categories}
            onChange={(value) => updateFilter('category', value)}
          />
          <FilterSelect
            value={filters.packagingType}
            placeholder="Packaging type"
            options={filterOptions.packagingTypes}
            onChange={(value) => updateFilter('packagingType', value)}
          />
          <FilterSelect
            value={filters.uom}
            placeholder="UOM"
            options={filterOptions.uoms}
            onChange={(value) => updateFilter('uom', value)}
          />
          <button
            type="button"
            onClick={resetFilters}
            disabled={!hasFilters}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
        </div>

        {loading ? (
          <ProductsSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadProducts()} />
        ) : products.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid gap-3 p-4 sm:px-5 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <Pagination
              page={currentPage}
              totalPages={totalPages}
              total={totalProducts}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function ProductCard({ product }: { product: CustomerProduct }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[#decbe5] hover:bg-[#fdfafd]">
      <Link
        to={`/customer/products/${product.id}`}
        className="mb-4 block focus:outline-none focus:ring-2 focus:ring-[#54247a]/20"
        aria-label={`View ${product.productName}`}
      >
        <ProductImage image={product.image} productName={product.productName} />
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/customer/products/${product.id}`}
            className="block truncate text-base font-bold text-slate-950 transition hover:text-[#54247a]"
          >
            {product.productName}
          </Link>
          <Link
            to={`/customer/products/${product.id}`}
            className="mt-1 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500 transition hover:text-[#54247a]"
          >
            {product.productCode}
          </Link>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-full bg-[#f6f2fa] px-2.5 py-1 text-xs font-bold text-[#54247a]">
          {product.category}
        </span>
      </div>

      {product.shortDescription && (
        <p className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-slate-600">
          {product.shortDescription}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
        <ProductMeta label="Packaging" value={product.packagingType} />
        <ProductMeta label="UOM" value={product.uom} />
        <ProductMeta label="Price" value="Price on Request" />
      </dl>
    </article>
  );
}

function ProductMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-slate-800">{value}</dd>
    </div>
  );
}

function FilterInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10"
    />
  );
}

function FilterSelect({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#54247a] focus:ring-2 focus:ring-[#54247a]/10"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const start = total === 0 ? 0 : (page - 1) * 10 + 1;
  const end = Math.min(page * 10, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <span>
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft size={15} />
          Previous
        </button>
        <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="grid gap-3 p-4 sm:px-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-slate-100 p-4">
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="mt-5 h-12 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="h-10 animate-pulse rounded bg-slate-100" />
            <div className="h-10 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center gap-3 px-5 py-8 text-sm font-semibold text-slate-500">
      <PackageSearch size={18} />
      No active products match the selected filters.
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-8 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
      <span className="inline-flex items-center gap-2">
        <AlertCircle size={18} />
        {message}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
      >
        <RefreshCw size={15} />
        Retry
      </button>
    </div>
  );
}
