import { AlertCircle, ArrowLeft, ImageIcon, Package, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCustomerProduct, type CustomerProduct } from '../../services/customerProductsService';

export function CustomerProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState<CustomerProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadProduct = useCallback(async () => {
    if (!id) {
      setError('Product id is missing.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      setProduct(await getCustomerProduct(id));
    } catch {
      setError('We could not load this product. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  return (
    <div className="space-y-4">
      <Link
        to="/customer/products"
        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-[#decbe5] hover:bg-[#f6f2fa] hover:text-[#54247a]"
      >
        <ArrowLeft size={16} />
        Back to Products
      </Link>

      {loading ? (
        <ProductDetailsSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadProduct()} />
      ) : product ? (
        <ProductDetailsCard product={product} />
      ) : (
        <ErrorState message="Product details are unavailable." onRetry={() => void loadProduct()} />
      )}
    </div>
  );
}

function ProductDetailsCard({ product }: { product: CustomerProduct }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7c3b7e]">
                Product Details
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950">{product.productName}</h1>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.08em] text-slate-500">
                {product.productCode}
              </p>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-[#f6f2fa] px-3 py-1.5 text-xs font-bold text-[#54247a]">
              {product.category}
            </span>
          </div>

          <div className="py-5">
            <h2 className="text-sm font-bold text-slate-950">Description</h2>
            <p className="mt-2 text-sm font-medium leading-6 text-slate-600">
              {product.description || product.shortDescription || 'No description available.'}
            </p>
          </div>

          <dl className="grid gap-3 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <DetailField label="Category" value={product.category} />
            <DetailField label="Packaging Type" value={product.packagingType} />
            <DetailField label="UOM" value={product.uom} />
          </dl>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Package className="h-4 w-4 text-[#54247a]" />
            Product Image
          </div>
          <div className="mt-4 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {product.image ? (
              <img
                src={product.image}
                alt={product.productName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-sm font-semibold text-slate-400">
                <ImageIcon size={32} />
                No image available
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-slate-900">{value}</dd>
    </div>
  );
}

function ProductDetailsSkeleton() {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
      <div className="mt-4 h-7 w-72 max-w-full animate-pulse rounded bg-slate-100" />
      <div className="mt-3 h-4 w-40 animate-pulse rounded bg-slate-100" />
      <div className="mt-8 h-20 animate-pulse rounded bg-slate-100" />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </section>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 px-5 py-5 text-sm font-semibold text-red-700 sm:flex-row sm:items-center sm:justify-between">
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
    </section>
  );
}
