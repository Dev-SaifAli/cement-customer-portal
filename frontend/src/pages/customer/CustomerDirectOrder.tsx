import { NativeTomSelect } from '../../components/ui/NativeTomSelect';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Loader2,
  PackageSearch,
  Search,
  ShoppingCart,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ProductImage } from '../../components/customer/ProductImage';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import {
  createDirectOrder,
  priceDirectOrder,
  type DirectOrderInput,
  type DirectOrderPricing,
  type CustomerOrder,
} from '../../services/customerOrdersService';
import {
  getCustomerLocations,
  type CustomerLocation,
} from '../../services/customerLocationsService';
import { getCustomerProducts, type CustomerProduct } from '../../services/customerProductsService';
import { getPickupLocations, type PickupLocation } from '../../services/customerQuotationsService';
import { createClientId } from '../../utils/createClientId';

type FulfilmentType = DirectOrderInput['fulfilmentType'];

const today = new Date().toISOString().slice(0, 10);

export function CustomerDirectOrder() {
  const { user } = useCustomerAuth();
  const requestId = useRef(createClientId());
  const [products, setProducts] = useState<CustomerProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<CustomerProduct | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [locations, setLocations] = useState<CustomerLocation[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [quantity, setQuantity] = useState('');
  const [fulfilmentType, setFulfilmentType] = useState<FulfilmentType>('DELIVERY');
  const [shipToLocationId, setShipToLocationId] = useState('');
  const [pickupLocationId, setPickupLocationId] = useState('');
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [pricing, setPricing] = useState<DirectOrderPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<CustomerOrder | null>(null);

  const canCreate = user?.role === 'CUSTOMER_ADMIN' || user?.role === 'PURCHASER';
  const quantityTons = Number(quantity);
  const selectedLocation = locations.find((location) => location.id === shipToLocationId) ?? null;
  const hasMappedLocations = locations.some(hasMapCoordinates);
  const hasUnmappedLocations = locations.some((location) => !hasMapCoordinates(location));
  const selectedPickup =
    pickupLocations.find((location) => location.id === pickupLocationId) ?? null;

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCustomerProducts(), getCustomerLocations(), getPickupLocations()])
      .then(([productResult, customerLocations, pickupResult]) => {
        if (cancelled) return;
        setProducts(productResult.items);
        setLocations(customerLocations);
        setPickupLocations(pickupResult);
        const mappedPrimaryLocation = customerLocations.find(
          (location) => location.isPrimary && hasMapCoordinates(location),
        );
        const firstMappedLocation = customerLocations.find(hasMapCoordinates);
        setShipToLocationId(mappedPrimaryLocation?.id ?? firstMappedLocation?.id ?? '');
        setPickupLocationId(pickupResult[0]?.id ?? '');
      })
      .catch(() => {
        if (!cancelled) setError('Unable to load direct order setup. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      getCustomerProducts({ search: productSearch.trim() })
        .then((result) => setProducts(result.items))
        .catch(() => setProducts([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  const pricingPayload = useMemo<DirectOrderInput | null>(() => {
    if (!selectedProduct || !Number.isFinite(quantityTons) || quantityTons <= 0) return null;
    if (fulfilmentType === 'DELIVERY' && !shipToLocationId) return null;
    if (fulfilmentType === 'DELIVERY' && !hasMapCoordinates(selectedLocation)) return null;
    if (fulfilmentType === 'PICKUP' && !pickupLocationId) return null;
    return {
      productId: selectedProduct.id,
      quantityTons,
      fulfilmentType,
      shipToLocationId: fulfilmentType === 'DELIVERY' ? shipToLocationId : null,
      pickupLocationId: fulfilmentType === 'PICKUP' ? pickupLocationId : null,
      requestedDeliveryDate:
        fulfilmentType === 'DELIVERY' && requestedDeliveryDate ? requestedDeliveryDate : null,
      notes: notes.trim() || null,
    };
  }, [
    fulfilmentType,
    notes,
    pickupLocationId,
    quantityTons,
    requestedDeliveryDate,
    selectedProduct,
    selectedLocation,
    shipToLocationId,
  ]);

  useEffect(() => {
    if (!pricingPayload) {
      setPricing(null);
      setPricingLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPricingLoading(true);
      setError('');
      priceDirectOrder(pricingPayload)
        .then((result) => {
          if (!cancelled) setPricing(result);
        })
        .catch((pricingError) => {
          if (!cancelled) {
            setPricing(null);
            setError(
              pricingError instanceof Error
                ? pricingError.message
                : 'Unable to calculate order pricing.',
            );
          }
        })
        .finally(() => {
          if (!cancelled) setPricingLoading(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pricingPayload]);

  if (!canCreate) {
    return <State message="Your role does not have permission to create direct orders." error />;
  }
  if (loading) return <State message="Loading direct order setup..." loading />;

  if (createdOrder) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl items-center justify-center">
        <section className="customer-card customer-border w-full rounded-2xl border p-8 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={30} />
          </span>
          <h1 className="customer-text mt-5 text-2xl font-bold">Order Created Successfully</h1>
          <p className="customer-secondary mt-2 text-sm">
            Your direct order was submitted and is ready for processing.
          </p>
          <div className="customer-surface-secondary customer-border mt-6 rounded-xl border p-4">
            <SummaryRow label="Order Number" value={createdOrder.orderNumber} strong />
            <div className="mt-3">
              <SummaryRow label="Status" value="Submitted" />
            </div>
          </div>
          <div className="mt-6 flex flex-col-reverse justify-center gap-3 sm:flex-row">
            <Link
              to="/customer/orders"
              className="customer-surface customer-border customer-text inline-flex h-10 items-center justify-center rounded-lg border px-5 text-sm font-bold"
            >
              Back to Orders
            </Link>
            <Link
              to={`/customer/orders/${createdOrder.id}`}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--customer-primary)] px-5 text-sm font-bold text-white hover:bg-[var(--customer-primary-hover)]"
            >
              View Order
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const validateAndReview = () => {
    setError('');
    if (!selectedProduct) return setError('Select a product to continue.');
    if (!Number.isFinite(quantityTons) || quantityTons <= 0)
      return setError('Enter a quantity greater than zero TON.');
    if (fulfilmentType === 'DELIVERY' && !hasMappedLocations)
      return setError(
        'Set a delivery location on the map before creating a Direct Order. Open Delivery Locations, edit the location, and select its map position.',
      );
    if (fulfilmentType === 'DELIVERY' && !shipToLocationId)
      return setError('Select a ship-to location.');
    if (fulfilmentType === 'DELIVERY' && !hasMapCoordinates(selectedLocation))
      return setError(
        'Set the delivery location on the map before creating a Direct Order. Open Delivery Locations, edit the location, and select its map position.',
      );
    if (fulfilmentType === 'DELIVERY' && !requestedDeliveryDate)
      return setError('Select a requested delivery date.');
    if (fulfilmentType === 'PICKUP' && !pickupLocationId)
      return setError('Select a pickup location.');
    if (!pricing) return setError('Wait for pricing to be calculated before continuing.');
    setReviewOpen(true);
  };

  const submit = async () => {
    if (!pricingPayload || !pricing) return;
    setSubmitting(true);
    setError('');
    try {
      const order = await createDirectOrder({
        ...pricingPayload,
        clientRequestId: requestId.current,
      });
      setReviewOpen(false);
      setCreatedOrder(order);
    } catch (submitError) {
      setReviewOpen(false);
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1450px] space-y-4">
      <div>
        <Link
          to="/customer/orders"
          className="customer-secondary inline-flex items-center gap-2 text-sm font-semibold hover:text-[var(--customer-primary)]"
        >
          <ArrowLeft size={16} /> Orders
        </Link>
        <h1 className="customer-text mt-2 text-2xl font-bold">New Direct Order</h1>
        <p className="customer-secondary mt-1 text-sm">Create a new cement order request.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Section title="Product & Quantity" icon={<PackageSearch size={18} />}>
            <div>
              <Field label="Product" required>
                <div
                  className="relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setProductPickerOpen(false);
                    }
                  }}
                >
                  <Search
                    size={16}
                    className="customer-muted pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2"
                  />
                  <input
                    value={productSearch}
                    onFocus={() => setProductPickerOpen(true)}
                    onChange={(event) => {
                      setProductSearch(event.target.value);
                      setSelectedProduct(null);
                      setPricing(null);
                      setProductPickerOpen(true);
                    }}
                    placeholder="Search and select product by name or code"
                    role="combobox"
                    aria-expanded={productPickerOpen}
                    aria-controls="direct-order-product-results"
                    className={`${fieldClass} pl-9`}
                  />
                  {productPickerOpen && (
                    <div
                      id="direct-order-product-results"
                      className="customer-card customer-border absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border p-1 shadow-lg"
                    >
                      {products.length === 0 ? (
                        <p className="customer-muted px-3 py-5 text-center text-sm">
                          No matching products found.
                        </p>
                      ) : (
                        products.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => {
                              setSelectedProduct(product);
                              setProductSearch(product.productName);
                              setPricing(null);
                              setProductPickerOpen(false);
                            }}
                            className="customer-text flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-[var(--customer-primary-soft)] focus:bg-[var(--customer-primary-soft)] focus:outline-none"
                          >
                            <ProductImage
                              image={product.image}
                              productName={product.productName}
                              size="thumbnail"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">
                                {product.productName}
                              </span>
                              <span className="customer-secondary mt-0.5 block truncate text-xs">
                                {product.productCode} · {product.packagingType} · {product.uom}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </Field>
            </div>

            {selectedProduct && (
              <div className="customer-surface-secondary customer-border mt-4 flex items-center gap-3 rounded-xl border p-3">
                <ProductImage
                  image={selectedProduct.image}
                  productName={selectedProduct.productName}
                  size="summary"
                />
                <div className="min-w-0">
                  <p className="customer-text truncate text-sm font-bold">
                    {selectedProduct.productName}
                  </p>
                  <p className="customer-muted mt-0.5 text-xs">{selectedProduct.productCode}</p>
                  <p className="customer-secondary mt-1 text-xs font-semibold">
                    {selectedProduct.packagingType} · {selectedProduct.uom}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Field label="Quantity TON" required>
                <div className="relative">
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder="Enter quantity"
                    className={`${fieldClass} pr-14`}
                  />
                  <span className="customer-secondary pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold">
                    TON
                  </span>
                </div>
              </Field>
              <Field label="Packaging Equivalent">
                <div className="customer-surface-secondary customer-border flex h-10 items-center rounded-lg border px-3 text-sm font-semibold">
                  {pricing?.equivalentPackagingUnits !== null &&
                  pricing?.equivalentPackagingUnits !== undefined
                    ? `${formatNumber(pricing.equivalentPackagingUnits)} Bags`
                    : selectedProduct?.uom === 'TON' && quantityTons > 0
                      ? `${formatNumber(quantityTons)} TON (Bulk)`
                      : 'Calculated from product weight'}
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Fulfilment" icon={<Truck size={18} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <FulfilmentOption
                active={fulfilmentType === 'DELIVERY'}
                icon={<Truck size={19} />}
                title="Delivery"
                description="AlSafwa Hader delivery to your ship-to location"
                onClick={() => setFulfilmentType('DELIVERY')}
              />
              <FulfilmentOption
                active={fulfilmentType === 'PICKUP'}
                icon={<Warehouse size={19} />}
                title="Pick-Up"
                description="Collect the order from an AlSafwa pickup location"
                onClick={() => setFulfilmentType('PICKUP')}
              />
            </div>

            {fulfilmentType === 'DELIVERY' ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <Field label="Hader City">
                  <div className="customer-surface-secondary customer-border flex h-10 items-center rounded-lg border px-3 text-sm font-semibold">
                    {selectedLocation?.city || 'Select a ship-to location'}
                  </div>
                </Field>
                <Field label="Ship-to Address" required>
                  <NativeTomSelect
                    value={shipToLocationId}
                    onChange={(event) => setShipToLocationId(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Select ship-to location</option>
                    {locations.map((location) => (
                      <option
                        key={location.id}
                        value={location.id}
                        disabled={!hasMapCoordinates(location)}
                      >
                        {location.name} — {location.city}, {location.region}
                        {!hasMapCoordinates(location) ? ' — Map location required' : ''}
                      </option>
                    ))}
                  </NativeTomSelect>
                  {hasUnmappedLocations && (
                    <p className="customer-secondary mt-2 text-xs leading-5">
                      Locations marked –Map location requiredâ€ cannot be used for delivery orders.{' '}
                      <Link
                        to="/customer/locations"
                        className="font-bold text-[var(--customer-primary)] hover:underline"
                      >
                        Set the delivery location on the map
                      </Link>
                      .
                    </p>
                  )}
                </Field>
                <Field label="Requested Delivery Date" required>
                  <div className="relative">
                    <CalendarDays
                      className="customer-muted pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                      size={16}
                    />
                    <input
                      type="date"
                      min={today}
                      value={requestedDeliveryDate}
                      onChange={(event) => setRequestedDeliveryDate(event.target.value)}
                      className={`${fieldClass} pl-9`}
                    />
                  </div>
                </Field>
                <Field label="Delivery Notes">
                  <input
                    value={notes}
                    maxLength={1000}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional delivery instructions"
                    className={fieldClass}
                  />
                </Field>
              </div>
            ) : (
              <div className="mt-5">
                <Field label="Pickup Location" required>
                  <NativeTomSelect
                    value={pickupLocationId}
                    onChange={(event) => setPickupLocationId(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Select pickup location</option>
                    {pickupLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name} — {location.city}
                      </option>
                    ))}
                  </NativeTomSelect>
                </Field>
              </div>
            )}
          </Section>
        </div>

        <aside className="customer-card customer-border rounded-2xl border p-5 xl:sticky xl:top-20">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="customer-primary" />
            <h2 className="customer-text text-base font-bold">Order Summary</h2>
          </div>
          <div className="customer-border-soft mt-4 space-y-3 border-b pb-4">
            <SummaryRow label="Product" value={selectedProduct?.productName ?? 'Not selected'} />
            <SummaryRow
              label="Packaging"
              value={selectedProduct?.packagingType ?? 'Not selected'}
            />
            <SummaryRow
              label="Quantity"
              value={quantityTons > 0 ? `${formatNumber(quantityTons)} TON` : 'Not entered'}
            />
            <SummaryRow
              label="Fulfilment"
              value={fulfilmentType === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up'}
            />
            <SummaryRow
              label="Location"
              value={
                fulfilmentType === 'DELIVERY'
                  ? (selectedLocation?.name ?? 'Not selected')
                  : (selectedPickup?.name ?? 'Not selected')
              }
            />
          </div>

          {pricingLoading ? (
            <div className="customer-secondary flex items-center justify-center gap-2 py-8 text-sm font-semibold">
              <Loader2 size={17} className="animate-spin" /> Calculating pricing...
            </div>
          ) : pricing ? (
            <div className="mt-4 space-y-3">
              <SummaryRow label="Customer Rate / TON" value={money(pricing.customerRatePerTon)} />
              <SummaryRow label="Subtotal" value={money(pricing.subtotal)} />
              <SummaryRow label={`VAT (${pricing.vatRate}%)`} value={money(pricing.vatAmount)} />
              <div className="customer-border-soft border-t pt-3">
                <SummaryRow label="Grand Total" value={money(pricing.grandTotal)} strong />
              </div>
            </div>
          ) : (
            <p className="customer-muted py-8 text-center text-sm">
              Select a product, quantity, and location to calculate pricing.
            </p>
          )}

          <div className="customer-primary-soft customer-primary mt-5 rounded-xl px-3 py-3 text-xs font-semibold">
            Pricing is calculated securely using the current customer rate. Internal price
            components are not displayed.
          </div>
          <button
            type="button"
            onClick={validateAndReview}
            disabled={pricingLoading || !pricing}
            className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[var(--customer-primary)] px-5 text-sm font-bold text-white transition hover:bg-[var(--customer-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Review Order
          </button>
        </aside>
      </div>

      {reviewOpen && pricing && (
        <ReviewDialog
          pricing={pricing}
          location={
            fulfilmentType === 'DELIVERY'
              ? [
                  selectedLocation?.name,
                  selectedLocation?.streetAddress,
                  selectedLocation?.city,
                  selectedLocation?.region,
                ]
                  .filter(Boolean)
                  .join(', ')
              : [selectedPickup?.name, selectedPickup?.city].filter(Boolean).join(', ')
          }
          submitting={submitting}
          onCancel={() => setReviewOpen(false)}
          onSubmit={() => void submit()}
        />
      )}
    </div>
  );
}

const fieldClass =
  'customer-input customer-border customer-text h-10 w-full rounded-lg border px-3 text-sm font-medium outline-none transition placeholder:text-[var(--customer-text-muted)] focus:border-[var(--customer-primary)] focus:ring-2 focus:ring-[var(--customer-primary-soft)]';

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="customer-card rounded-2xl border p-5">
      <div className="customer-border-soft flex items-center gap-2 border-b pb-3">
        <span className="customer-primary-soft customer-primary flex h-8 w-8 items-center justify-center rounded-lg">
          {icon}
        </span>
        <h2 className="customer-text text-base font-bold">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="customer-text mb-1.5 block text-xs font-bold">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function FulfilmentOption({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`customer-border flex items-start gap-3 rounded-xl border p-4 text-left transition ${
        active
          ? 'border-[var(--customer-primary)] bg-[var(--customer-primary-soft)]'
          : 'customer-surface hover:border-[var(--customer-primary)]'
      }`}
    >
      <span className={`mt-0.5 ${active ? 'customer-primary' : 'customer-muted'}`}>{icon}</span>
      <span>
        <span className="customer-text block text-sm font-bold">{title}</span>
        <span className="customer-secondary mt-1 block text-xs">{description}</span>
      </span>
    </button>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="customer-secondary">{label}</span>
      <span
        className={`text-right ${strong ? 'customer-primary text-base font-extrabold' : 'customer-text font-bold'}`}
      >
        {value}
      </span>
    </div>
  );
}

function ReviewDialog({
  pricing,
  location,
  submitting,
  onCancel,
  onSubmit,
}: {
  pricing: DirectOrderPricing;
  location: string;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <section
        className="customer-card w-full max-w-xl rounded-2xl border p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="direct-order-review-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="direct-order-review-title" className="customer-text text-lg font-bold">
              Review Order
            </h2>
            <p className="customer-secondary mt-1 text-sm">
              Confirm the order details before submission.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="customer-secondary rounded-lg p-2 hover:bg-[var(--customer-surface-secondary)]"
            aria-label="Close review"
          >
            <X size={18} />
          </button>
        </div>
        <div className="customer-surface-secondary customer-border mt-5 rounded-xl border p-4">
          <SummaryRow label="Product" value={`${pricing.product.name} (${pricing.product.code})`} />
          <div className="mt-3">
            <SummaryRow label="Packaging" value={pricing.product.packaging} />
          </div>
          <div className="mt-3">
            <SummaryRow label="Requested TON" value={`${formatNumber(pricing.quantityTons)} TON`} />
          </div>
          {pricing.equivalentPackagingUnits !== null && (
            <div className="mt-3">
              <SummaryRow
                label="Equivalent Bags"
                value={`${formatNumber(pricing.equivalentPackagingUnits)} Bags`}
              />
            </div>
          )}
          {pricing.fulfilmentType === 'DELIVERY' && (
            <div className="mt-3">
              <SummaryRow label="Hader City" value={pricing.haderCity.name} />
            </div>
          )}
          <div className="mt-3">
            <SummaryRow
              label="Fulfilment"
              value={pricing.fulfilmentType === 'DELIVERY' ? 'Hader Delivery' : 'Pick-Up'}
            />
          </div>
          <div className="mt-3">
            <SummaryRow label="Location" value={location || 'Not provided'} />
          </div>
          <div className="customer-border-soft mt-4 space-y-3 border-t pt-4">
            <SummaryRow label="Customer Rate / TON" value={money(pricing.customerRatePerTon)} />
            <SummaryRow label="Subtotal" value={money(pricing.subtotal)} />
            <SummaryRow label={`VAT (${pricing.vatRate}%)`} value={money(pricing.vatAmount)} />
            <SummaryRow label="Grand Total" value={money(pricing.grandTotal)} strong />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="customer-surface customer-border customer-text h-10 rounded-lg border px-4 text-sm font-bold disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--customer-primary)] px-5 text-sm font-bold text-white hover:bg-[var(--customer-primary-hover)] disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            {submitting ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      </section>
    </div>
  );
}

function State({
  message,
  error = false,
  loading = false,
}: {
  message: string;
  error?: boolean;
  loading?: boolean;
}) {
  return (
    <div
      className={`customer-card flex items-center gap-2 rounded-2xl border p-8 text-sm font-semibold ${error ? 'text-red-600' : 'customer-secondary'}`}
    >
      {loading && <Loader2 size={17} className="animate-spin" />}
      {message}
    </div>
  );
}

function hasMapCoordinates(location: CustomerLocation | null): location is CustomerLocation & {
  latitude: number;
  longitude: number;
} {
  return (
    location !== null &&
    typeof location.latitude === 'number' &&
    Number.isFinite(location.latitude) &&
    typeof location.longitude === 'number' &&
    Number.isFinite(location.longitude)
  );
}

function formatNumber(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function money(value: number) {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}
