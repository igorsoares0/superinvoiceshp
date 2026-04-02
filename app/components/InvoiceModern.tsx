import type { TemplateConfig, OrderData, ShopData } from "../types/template";

interface InvoiceModernProps {
  config: TemplateConfig;
  order: OrderData;
  shop: ShopData;
}

export function InvoiceModern({ config, order, shop }: InvoiceModernProps) {
  const c = config;
  const hasSocialMedia =
    c.socialMedia.facebook ||
    c.socialMedia.instagram ||
    c.socialMedia.twitter ||
    c.socialMedia.linkedin ||
    c.socialMedia.website;

  return (
    <div style={s.page}>
      {/* Header — centered, elegant */}
      <div style={s.header}>
        {shop.logoUrl && (
          <img src={shop.logoUrl} alt="Logo" style={s.logo} />
        )}
        <div style={s.shopName}>{shop.name || "Sua Loja"}</div>
        {shop.email && <div style={s.shopEmail}>{shop.email}</div>}
      </div>

      {/* Invoice meta — clean right-aligned block */}
      <div style={s.metaRow}>
        <div style={s.metaLeft}>
          {c.orderInfo.showInvoiceNumber && (
            <div style={s.invoiceLabel}>FATURA</div>
          )}
          {c.orderInfo.showInvoiceNumber && (
            <div style={s.invoiceNumber}>{order.invoiceNumber}</div>
          )}
        </div>
        <div style={s.metaRight}>
          {c.orderInfo.showOrderNumber && (
            <MetaItem label="Pedido" value={order.name} />
          )}
          {c.orderInfo.showPurchaseOrderNumber && order.poNumber && (
            <MetaItem label="PO" value={order.poNumber} />
          )}
          {c.orderInfo.showOrderDate && (
            <MetaItem label="Data" value={formatDate(order.createdAt)} />
          )}
          {c.orderInfo.showClosingDate && order.closedAt && (
            <MetaItem label="Fechamento" value={formatDate(order.closedAt)} />
          )}
          {c.orderInfo.showOrderValue && (
            <MetaItem
              label="Valor"
              value={formatCurrency(order.total, order.currency)}
            />
          )}
          {c.orderInfo.showOrderTags && order.tags.length > 0 && (
            <MetaItem label="Tags" value={order.tags.join(", ")} />
          )}
        </div>
      </div>

      <div style={s.divider} />

      {/* Addresses — side by side with generous spacing */}
      {(c.paymentInfo.showBillingAddress ||
        c.shippingInfo.showShippingAddress) && (
        <div style={s.addressRow}>
          {c.paymentInfo.showBillingAddress && order.billingAddress && (
            <div style={s.addressBlock}>
              <div style={s.label}>Cobrar</div>
              {order.billingAddress.formatted.map((line, i) => (
                <div key={i} style={s.addressLine}>
                  {line}
                </div>
              ))}
            </div>
          )}
          {c.shippingInfo.showShippingAddress && order.shippingAddress && (
            <div style={s.addressBlock}>
              <div style={s.label}>Enviar</div>
              {order.shippingAddress.formatted.map((line, i) => (
                <div key={i} style={s.addressLine}>
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact & Payment */}
      {(c.shippingInfo.showCustomerEmail ||
        c.shippingInfo.showCustomerPhone ||
        c.paymentInfo.showPaymentMethod ||
        c.paymentInfo.showCreditCard) && (
        <div style={s.contactRow}>
          {c.shippingInfo.showCustomerEmail && order.customer?.email && (
            <MetaItem label="Email" value={order.customer.email} />
          )}
          {c.shippingInfo.showCustomerPhone && order.customer?.phone && (
            <MetaItem label="Telefone" value={order.customer.phone} />
          )}
          {c.paymentInfo.showPaymentMethod && order.paymentMethod && (
            <MetaItem label="Pagamento" value={order.paymentMethod} />
          )}
          {c.paymentInfo.showCreditCard && order.creditCard && (
            <MetaItem
              label="Cartão"
              value={`${order.creditCard.company} •••• ${order.creditCard.lastFour}`}
            />
          )}
        </div>
      )}

      <div style={s.spacer} />

      {/* Line Items — borderless modern table */}
      <table style={s.table}>
        <thead>
          <tr>
            {c.itemDetails.product.showImage && <th style={s.th} />}
            {c.itemDetails.quantity.showTotalQuantity && (
              <th style={{ ...s.th, width: "48px", textAlign: "center" as const }}>
                Qtd
              </th>
            )}
            <th style={s.th}>Descrição</th>
            <th style={s.thRight}>Preço</th>
            {c.itemDetails.pricing.showDiscount && (
              <th style={s.thRight}>Desc.</th>
            )}
            {c.itemDetails.quantity.showItemTotalTax && (
              <th style={s.thRight}>Imposto</th>
            )}
            <th style={s.thRight}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.lineItems.map((item, idx) => (
            <tr key={idx}>
              {c.itemDetails.product.showImage && (
                <td style={s.td}>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={s.productImage}
                    />
                  ) : (
                    <div style={s.imagePlaceholder} />
                  )}
                </td>
              )}
              {c.itemDetails.quantity.showTotalQuantity && (
                <td style={{ ...s.td, textAlign: "center" as const }}>
                  {item.quantity}
                </td>
              )}
              <td style={s.td}>
                <div style={s.itemName}>{item.name}</div>
                <div style={s.itemMetaRow}>
                  {c.itemDetails.product.showSku && item.sku && (
                    <span style={s.itemMeta}>SKU: {item.sku}</span>
                  )}
                  {c.itemDetails.product.showVariant && item.variant && (
                    <span style={s.itemMeta}>{item.variant}</span>
                  )}
                  {c.itemDetails.product.showWeight && item.weight && (
                    <span style={s.itemMeta}>{item.weight}</span>
                  )}
                  {c.itemDetails.product.showProductType && item.productType && (
                    <span style={s.itemMeta}>{item.productType}</span>
                  )}
                </div>
                {c.itemDetails.pricing.showDiscountReason &&
                  item.discountReason && (
                    <div style={s.discountTag}>{item.discountReason}</div>
                  )}
              </td>
              <td style={s.tdRight}>
                {c.itemDetails.pricing.showCompareAtPrice &&
                  item.compareAtPrice && (
                    <div style={s.comparePrice}>
                      {formatCurrency(item.compareAtPrice, order.currency)}
                    </div>
                  )}
                <div>
                  {c.itemDetails.pricing.showPriceExcludingTax
                    ? formatCurrency(item.price, order.currency)
                    : c.itemDetails.pricing.showPriceAfterDiscount
                      ? formatCurrency(item.priceAfterDiscount, order.currency)
                      : formatCurrency(item.price, order.currency)}
                </div>
              </td>
              {c.itemDetails.pricing.showDiscount && (
                <td style={s.tdRight}>
                  {Number(item.discount) > 0
                    ? `-${formatCurrency(item.discount, order.currency)}`
                    : "—"}
                </td>
              )}
              {c.itemDetails.quantity.showItemTotalTax && (
                <td style={s.tdRight}>
                  {formatCurrency(item.taxTotal, order.currency)}
                </td>
              )}
              <td style={{ ...s.tdRight, fontWeight: 500 }}>
                {formatCurrency(item.total, order.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={s.spacer} />

      {/* Totals — right-aligned, clean */}
      <div style={s.totalsSection}>
        {c.orderTotals.summary.showSubtotal && (
          <TotalRow
            label="Subtotal"
            value={formatCurrency(order.subtotal, order.currency)}
          />
        )}
        {c.orderTotals.summary.showDiscount &&
          Number(order.totalDiscount) > 0 && (
            <TotalRow
              label="Desconto"
              value={`-${formatCurrency(order.totalDiscount, order.currency)}`}
            />
          )}
        {c.orderTotals.summary.showDiscountReason && order.discountReason && (
          <div style={s.discountReasonNote}>({order.discountReason})</div>
        )}
        {c.orderTotals.shipping.showShipping && (
          <TotalRow
            label={
              c.orderTotals.shipping.showShippingRateName &&
              order.shippingRateName
                ? `Envio (${order.shippingRateName})`
                : "Envio"
            }
            value={formatCurrency(order.shippingTotal, order.currency)}
          />
        )}
        {c.orderTotals.tax.showExcludingTax && (
          <>
            {c.orderTotals.tax.groupTaxLines && order.taxLines.length > 0
              ? order.taxLines.map((tax, i) => (
                  <TotalRow
                    key={i}
                    label={`${c.orderTotals.tax.showTaxLabel ? "Imposto" : tax.title} (${tax.rate})`}
                    value={formatCurrency(tax.amount, order.currency)}
                  />
                ))
              : (
                  <TotalRow
                    label={
                      c.orderTotals.tax.showTaxLabel ? "Imposto" : "Impostos"
                    }
                    value={formatCurrency(order.taxTotal, order.currency)}
                  />
                )}
          </>
        )}
        {c.orderTotals.tax.showDuties && Number(order.duties) > 0 && (
          <TotalRow
            label="Duties"
            value={formatCurrency(order.duties, order.currency)}
          />
        )}

        {/* Grand total — highlighted */}
        <div style={s.grandTotalRow}>
          <span style={s.grandTotalLabel}>TOTAL</span>
          <span style={s.grandTotalValue}>
            {formatCurrency(order.total, order.currency)}
          </span>
        </div>

        {c.orderTotals.payment.showPaidByCustomer && (
          <TotalRow
            label="Pago pelo cliente"
            value={formatCurrency(order.paidByCustomer, order.currency)}
          />
        )}
        {c.orderTotals.payment.showRefundAmount &&
          Number(order.refundAmount) > 0 && (
            <TotalRow
              label="Reembolso"
              value={`-${formatCurrency(order.refundAmount, order.currency)}`}
            />
          )}
        {c.orderTotals.payment.showNetPayment && (
          <TotalRow
            label="Pagamento líquido"
            value={formatCurrency(order.netPayment, order.currency)}
          />
        )}
        {c.orderTotals.payment.showBalance && (
          <TotalRow
            label="Saldo"
            value={formatCurrency(order.balance, order.currency)}
          />
        )}
      </div>

      {/* Barcode */}
      {c.additional.barcode.showBarcode && (
        <div style={s.barcodeSection}>
          <div style={s.barcodePlaceholder}>
            [
            {c.additional.barcode.barcodeType === "qrcode"
              ? "QR Code"
              : c.additional.barcode.barcodeType === "code128"
                ? "Barcode 128"
                : "Barcode 39"}
            ]
          </div>
        </div>
      )}

      {/* Notes */}
      {c.additional.notes.showOrderNotes && order.note && (
        <div style={s.notesSection}>
          <div style={s.label}>Notas do pedido</div>
          <div style={s.noteText}>{order.note}</div>
        </div>
      )}
      {c.additional.notes.showFooterNotes &&
        c.additional.notes.footerNotesText && (
          <div style={s.notesSection}>
            <div style={s.noteText}>
              {c.additional.notes.footerNotesText}
            </div>
          </div>
        )}

      {/* Signature */}
      {c.additional.notes.showSignature && (
        <div style={s.signatureSection}>
          <div style={s.signatureLine} />
          <div style={s.signatureLabel}>Assinatura</div>
        </div>
      )}

      {/* Social Media — minimal footer */}
      {hasSocialMedia && (
        <div style={s.socialSection}>
          {c.socialMedia.facebook && (
            <span style={s.socialLink}>facebook.com/{c.socialMedia.facebook}</span>
          )}
          {c.socialMedia.instagram && (
            <span style={s.socialLink}>@{c.socialMedia.instagram}</span>
          )}
          {c.socialMedia.twitter && (
            <span style={s.socialLink}>@{c.socialMedia.twitter}</span>
          )}
          {c.socialMedia.linkedin && (
            <span style={s.socialLink}>{c.socialMedia.linkedin}</span>
          )}
          {c.socialMedia.website && (
            <span style={s.socialLink}>{c.socialMedia.website}</span>
          )}
        </div>
      )}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={s.metaItem}>
      <span style={s.metaLabel}>{label}</span>
      <span style={s.metaValue}>{value}</span>
    </div>
  );
}

function TotalRow({
  label,
  value,
}: {
  label: string;
  value: string;
  key?: number;
}) {
  return (
    <div style={s.totalRow}>
      <span style={s.totalLabel}>{label}</span>
      <span style={s.totalValue}>{value}</span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(amount: string, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

// --- Modern / Minimalist Styles ---
const s: Record<string, React.CSSProperties> = {
  page: {
    fontFamily:
      "'Inter', 'Helvetica Neue', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: "12px",
    color: "#2d2d2d",
    padding: "48px 40px",
    background: "#fff",
    maxWidth: "100%",
    lineHeight: 1.7,
    letterSpacing: "0.01em",
  },

  // Header — centered, airy
  header: {
    textAlign: "center" as const,
    marginBottom: "32px",
  },
  logo: {
    maxWidth: "120px",
    maxHeight: "48px",
    objectFit: "contain" as const,
    marginBottom: "12px",
  },
  shopName: {
    fontSize: "20px",
    fontWeight: 300,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#2d2d2d",
  },
  shopEmail: {
    fontSize: "11px",
    color: "#999",
    marginTop: "4px",
    letterSpacing: "0.02em",
  },

  // Meta row
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "24px",
  },
  metaLeft: {},
  metaRight: {
    textAlign: "right" as const,
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
  },
  invoiceLabel: {
    fontSize: "9px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.15em",
    color: "#999",
    marginBottom: "2px",
  },
  invoiceNumber: {
    fontSize: "22px",
    fontWeight: 300,
    color: "#2d2d2d",
    letterSpacing: "0.02em",
  },
  metaItem: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    alignItems: "baseline",
  },
  metaLabel: {
    fontSize: "10px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: "#aaa",
    fontWeight: 500,
  },
  metaValue: {
    fontSize: "11px",
    color: "#444",
  },

  // Divider — hairline
  divider: {
    borderTop: "1px solid #eee",
    margin: "20px 0",
  },
  spacer: {
    height: "24px",
  },

  // Addresses
  addressRow: {
    display: "flex",
    gap: "48px",
    marginBottom: "20px",
  },
  addressBlock: {
    flex: 1,
  },
  label: {
    fontSize: "9px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    color: "#aaa",
    marginBottom: "6px",
  },
  addressLine: {
    fontSize: "11px",
    color: "#444",
    lineHeight: 1.6,
  },

  // Contact
  contactRow: {
    display: "flex",
    gap: "24px",
    flexWrap: "wrap" as const,
    marginBottom: "8px",
  },

  // Table — clean, no heavy borders
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  th: {
    fontSize: "9px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "#aaa",
    borderBottom: "1px solid #e0e0e0",
    padding: "10px 8px",
    textAlign: "left" as const,
  },
  thRight: {
    fontSize: "9px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "#aaa",
    borderBottom: "1px solid #e0e0e0",
    padding: "10px 8px",
    textAlign: "right" as const,
  },
  td: {
    padding: "12px 8px",
    borderBottom: "1px solid #f5f5f5",
    verticalAlign: "top" as const,
    fontSize: "11px",
    color: "#444",
  },
  tdRight: {
    padding: "12px 8px",
    borderBottom: "1px solid #f5f5f5",
    verticalAlign: "top" as const,
    fontSize: "11px",
    color: "#444",
    textAlign: "right" as const,
  },
  productImage: {
    width: "40px",
    height: "40px",
    objectFit: "cover" as const,
    borderRadius: "6px",
  },
  imagePlaceholder: {
    width: "40px",
    height: "40px",
    background: "#f8f8f8",
    borderRadius: "6px",
  },
  itemName: {
    fontWeight: 500,
    fontSize: "12px",
    color: "#2d2d2d",
    marginBottom: "2px",
  },
  itemMetaRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap" as const,
  },
  itemMeta: {
    fontSize: "10px",
    color: "#aaa",
  },
  discountTag: {
    display: "inline-block",
    fontSize: "9px",
    color: "#888",
    background: "#f5f5f5",
    padding: "2px 6px",
    borderRadius: "3px",
    marginTop: "4px",
  },
  comparePrice: {
    textDecoration: "line-through",
    color: "#ccc",
    fontSize: "10px",
  },

  // Totals
  totalsSection: {
    maxWidth: "300px",
    marginLeft: "auto",
    marginTop: "8px",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    fontSize: "11px",
  },
  totalLabel: {
    color: "#888",
    fontWeight: 400,
  },
  totalValue: {
    color: "#444",
    fontWeight: 400,
  },
  discountReasonNote: {
    fontSize: "10px",
    color: "#aaa",
    textAlign: "right" as const,
    marginTop: "-2px",
  },
  grandTotalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 0 8px",
    marginTop: "8px",
    borderTop: "1px solid #e0e0e0",
  },
  grandTotalLabel: {
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    color: "#2d2d2d",
  },
  grandTotalValue: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#2d2d2d",
  },

  // Barcode
  barcodeSection: {
    textAlign: "center" as const,
    margin: "24px 0",
  },
  barcodePlaceholder: {
    display: "inline-block",
    padding: "20px 32px",
    border: "1px solid #eee",
    borderRadius: "8px",
    color: "#bbb",
    fontSize: "11px",
  },

  // Notes
  notesSection: {
    margin: "20px 0",
    padding: "12px 16px",
    background: "#fafafa",
    borderRadius: "6px",
    borderLeft: "3px solid #e0e0e0",
  },
  noteText: {
    fontSize: "11px",
    color: "#666",
    whiteSpace: "pre-wrap" as const,
    lineHeight: 1.6,
  },

  // Signature
  signatureSection: {
    marginTop: "40px",
    textAlign: "center" as const,
    maxWidth: "220px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  signatureLine: {
    borderTop: "1px solid #ccc",
    marginBottom: "6px",
  },
  signatureLabel: {
    fontSize: "9px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    color: "#aaa",
  },

  // Social
  socialSection: {
    borderTop: "1px solid #f0f0f0",
    marginTop: "28px",
    paddingTop: "12px",
    display: "flex",
    gap: "16px",
    justifyContent: "center",
    flexWrap: "wrap" as const,
  },
  socialLink: {
    fontSize: "10px",
    color: "#bbb",
    letterSpacing: "0.02em",
  },
};
