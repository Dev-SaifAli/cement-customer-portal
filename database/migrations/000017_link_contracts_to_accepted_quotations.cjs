exports.up = (pgm) => {
  pgm.addColumns('contracts', {
    quotation_id: {
      type: 'uuid',
      references: 'customer_quotations(id)',
      onDelete: 'RESTRICT',
    },
    quotation_reference: { type: 'text' },
    accepted_at: { type: 'timestamptz' },
    total_quantity_tons: { type: 'numeric(14, 3)' },
    subtotal: { type: 'numeric(16, 2)' },
    vat_rate: { type: 'numeric(7, 6)' },
    vat_amount: { type: 'numeric(16, 2)' },
    grand_total: { type: 'numeric(16, 2)' },
    payment_terms: { type: 'text' },
    commercial_notes: { type: 'text' },
    customer_notes: { type: 'text' },
    internal_notes: { type: 'text' },
    items_snapshot: { type: 'jsonb', notNull: true, default: pgm.func("'[]'::jsonb") },
  });

  pgm.addConstraint('contracts', 'contracts_quotation_id_unique', {
    unique: ['quotation_id'],
  });
  pgm.createIndex('contracts', 'quotation_id');
};

exports.down = (pgm) => {
  pgm.dropIndex('contracts', 'quotation_id');
  pgm.dropConstraint('contracts', 'contracts_quotation_id_unique');
  pgm.dropColumns('contracts', [
    'quotation_id',
    'quotation_reference',
    'accepted_at',
    'total_quantity_tons',
    'subtotal',
    'vat_rate',
    'vat_amount',
    'grand_total',
    'payment_terms',
    'commercial_notes',
    'customer_notes',
    'internal_notes',
    'items_snapshot',
  ]);
};
