import type { TemplateConfig, OrderData, ShopData } from "../types/template";

interface InvoiceClassicProps {
  config: TemplateConfig;
  order: OrderData;
  shop: ShopData;
}

export function InvoiceClassic({ config, order, shop }: InvoiceClassicProps) {
  const c = config;
  const hasSocialMedia =
    c.socialMedia.facebook ||
    c.socialMedia.instagram ||
    c.socialMedia.twitter ||
    c.socialMedia.linkedin ||
    c.socialMedia.website;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {shop.logoUrl && (
            <img
              src={shop.logoUrl}
              alt="Logo"
              style={styles.logo}
            />
          )}
          <div style={styles.shopName}>{shop.name || "Sua Loja"}</div>
          {shop.email && (
            <div style={styles.shopEmail}>{shop.email}</div>
          )}
        </div>
        <div style={styles.headerRight}>
          {c.orderInfo.showInvoiceNumber && (
            <div style={styles.invoiceNumber}>
              Fatura: {order.invoiceNumber}
            </div>
          )}
          {c.orderInfo.showOrderNumber && (
            <div style={styles.detail}>Pedido: {order.name}</div>
          )}
          {c.orderInfo.showPurchaseOrderNumber && order.poNumber && (
            <div style={styles.detail}>PO: {order.poNumber}</div>
          )}
          {c.orderInfo.showOrderDate && (
            <div style={styles.detail}>
              Data: {formatDate(order.createdAt)}
            </div>
          )}
          {c.orderInfo.showClosingDate && order.closedAt && (
            <div style={styles.detail}>
              Fechamento: {formatDate(order.closedAt)}
            </div>
          )}
          {c.orderInfo.showOrderValue && (
            <div style={styles.detail}>
              Valor: {formatCurrency(order.total, order.currency)}
            </div>
          )}
          {c.orderInfo.showOrderTags && order.tags.length > 0 && (
            <div style={styles.detail}>
              Tags: {order.tags.join(", ")}
            </div>
          )}
        </div>
      </div>

      <div style={styles.divider} />

      {/* Addresses */}
      {(c.paymentInfo.showBillingAddress || c.shippingInfo.showShippingAddress) && (
        <div style={styles.addressRow}>
          {c.paymentInfo.showBillingAddress && order.billingAddress && (
            <div style={styles.addressBlock}>
              <div style={styles.sectionLabel}>Cobrar</div>
              {order.billingAddress.formatted.map((line, i) => (
                <div key={i} style={styles.addressLine}>{line}</div>
              ))}
            </div>
          )}
          {c.shippingInfo.showShippingAddress && order.shippingAddress && (
            <div style={styles.addressBlock}>
              <div style={styles.sectionLabel}>Enviar</div>
              {order.shippingAddress.formatted.map((line, i) => (
                <div key={i} style={styles.addressLine}>{line}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact & Payment info */}
      {(c.shippingInfo.showCustomerEmail ||
        c.shippingInfo.showCustomerPhone ||
        c.paymentInfo.showPaymentMethod ||
        c.paymentInfo.showCreditCard) && (
        <div style={styles.contactRow}>
          {c.shippingInfo.showCustomerEmail && order.customer?.email && (
            <div style={styles.detail}>
              Email: {order.customer.email}
            </div>
          )}
          {c.shippingInfo.showCustomerPhone && order.customer?.phone && (
            <div style={styles.detail}>
              Telefone: {order.customer.phone}
            </div>
          )}
          {c.paymentInfo.showPaymentMethod && order.paymentMethod && (
            <div style={styles.detail}>
              Pagamento: {order.paymentMethod}
            </div>
          )}
          {c.paymentInfo.showCreditCard && order.creditCard && (
            <div style={styles.detail}>
              Cartão: {order.creditCard.company} **** {order.creditCard.lastFour}
            </div>
          )}
        </div>
      )}

      <div style={styles.divider} />

      {/* Line Items Table */}
      <table style={styles.table}>
        <thead>
          <tr>
            {c.itemDetails.product.showImage && (
              <th style={styles.th}></th>
            )}
            {c.itemDetails.quantity.showTotalQuantity && (
              <th style={{ ...styles.th, width: "40px" }}>Qtd</th>
            )}
            <th style={styles.th}>Item</th>
            <th style={{ ...styles.th, textAlign: "right" as const }}>Preço</th>
            {c.itemDetails.pricing.showDiscount && (
              <th style={{ ...styles.th, textAlign: "right" as const }}>Desc.</th>
            )}
            {c.itemDetails.quantity.showItemTotalTax && (
              <th style={{ ...styles.th, textAlign: "right" as const }}>Imposto</th>
            )}
            <th style={{ ...styles.th, textAlign: "right" as const }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {order.lineItems.map((item, idx) => (
            <tr key={idx}>
              {c.itemDetails.product.showImage && (
                <td style={styles.td}>
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      style={styles.productImage}
                    />
                  ) : (
                    <div style={styles.imagePlaceholder} />
                  )}
                </td>
              )}
              {c.itemDetails.quantity.showTotalQuantity && (
                <td style={styles.td}>{item.quantity}</td>
              )}
              <td style={styles.td}>
                <div style={styles.itemName}>{item.name}</div>
                {c.itemDetails.product.showSku && item.sku && (
                  <div style={styles.itemMeta}>SKU: {item.sku}</div>
                )}
                {c.itemDetails.product.showVariant && item.variant && (
                  <div style={styles.itemMeta}>{item.variant}</div>
                )}
                {c.itemDetails.product.showWeight && item.weight && (
                  <div style={styles.itemMeta}>Peso: {item.weight}</div>
                )}
                {c.itemDetails.product.showProductType && item.productType && (
                  <div style={styles.itemMeta}>Tipo: {item.productType}</div>
                )}
                {c.itemDetails.pricing.showDiscountReason && item.discountReason && (
                  <div style={styles.itemMeta}>
                    Desc.: {item.discountReason}
                  </div>
                )}
              </td>
              <td style={{ ...styles.td, textAlign: "right" as const }}>
                {c.itemDetails.pricing.showCompareAtPrice && item.compareAtPrice && (
                  <div style={styles.comparePrice}>
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
                <td style={{ ...styles.td, textAlign: "right" as const }}>
                  {Number(item.discount) > 0
                    ? `-${formatCurrency(item.discount, order.currency)}`
                    : "—"}
                </td>
              )}
              {c.itemDetails.quantity.showItemTotalTax && (
                <td style={{ ...styles.td, textAlign: "right" as const }}>
                  {formatCurrency(item.taxTotal, order.currency)}
                </td>
              )}
              <td style={{ ...styles.td, textAlign: "right" as const }}>
                {formatCurrency(item.total, order.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={styles.divider} />

      {/* Order Totals */}
      <div style={styles.totalsSection}>
        {c.orderTotals.summary.showSubtotal && (
          <TotalRow
            label="Subtotal"
            value={formatCurrency(order.subtotal, order.currency)}
          />
        )}
        {c.orderTotals.summary.showDiscount && Number(order.totalDiscount) > 0 && (
          <TotalRow
            label="Desconto"
            value={`-${formatCurrency(order.totalDiscount, order.currency)}`}
          />
        )}
        {c.orderTotals.summary.showDiscountReason && order.discountReason && (
          <div style={styles.discountReason}>({order.discountReason})</div>
        )}
        {c.orderTotals.shipping.showShipping && (
          <TotalRow
            label={
              c.orderTotals.shipping.showShippingRateName && order.shippingRateName
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
                  label={c.orderTotals.tax.showTaxLabel ? "Imposto" : "Impostos"}
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

        <div style={styles.totalDivider} />
        <TotalRow
          label="TOTAL"
          value={formatCurrency(order.total, order.currency)}
          bold
        />

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
        <div style={styles.barcodeSection}>
          <div style={styles.barcodePlaceholder}>
            [{c.additional.barcode.barcodeType === "qrcode"
              ? "QR Code"
              : c.additional.barcode.barcodeType === "code128"
                ? "Barcode 128"
                : "Barcode 39"}]
          </div>
        </div>
      )}

      {/* Notes */}
      {c.additional.notes.showOrderNotes && order.note && (
        <div style={styles.notesSection}>
          <div style={styles.sectionLabel}>Notas do pedido</div>
          <div style={styles.noteText}>{order.note}</div>
        </div>
      )}
      {c.additional.notes.showFooterNotes && c.additional.notes.footerNotesText && (
        <div style={styles.notesSection}>
          <div style={styles.noteText}>
            {c.additional.notes.footerNotesText}
          </div>
        </div>
      )}

      {/* Signature */}
      {c.additional.notes.showSignature && (
        <div style={styles.signatureSection}>
          <div style={styles.signatureLine} />
          <div style={styles.signatureLabel}>Assinatura</div>
        </div>
      )}

      {/* Social Media */}
      {hasSocialMedia && (
        <div style={styles.socialSection}>
          <div style={styles.socialLinks}>
            {c.socialMedia.facebook && (
              <span style={styles.socialLink}>fb: {c.socialMedia.facebook}</span>
            )}
            {c.socialMedia.instagram && (
              <span style={styles.socialLink}>ig: {c.socialMedia.instagram}</span>
            )}
            {c.socialMedia.twitter && (
              <span style={styles.socialLink}>tw: {c.socialMedia.twitter}</span>
            )}
            {c.socialMedia.linkedin && (
              <span style={styles.socialLink}>in: {c.socialMedia.linkedin}</span>
            )}
            {c.socialMedia.website && (
              <span style={styles.socialLink}>{c.socialMedia.website}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TotalRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div style={styles.totalRow}>
      <span style={bold ? styles.totalLabelBold : styles.totalLabel}>
        {label}
      </span>
      <span style={bold ? styles.totalValueBold : styles.totalValue}>
        {value}
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCurrency(amount: string, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: "12px",
    color: "#1a1a1a",
    padding: "32px",
    background: "#fff",
    maxWidth: "100%",
    lineHeight: 1.5,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "16px",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  headerRight: {
    textAlign: "right",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  logo: {
    maxWidth: "140px",
    maxHeight: "60px",
    objectFit: "contain" as const,
    marginBottom: "8px",
  },
  shopName: {
    fontSize: "16px",
    fontWeight: 700,
  },
  shopEmail: {
    fontSize: "11px",
    color: "#666",
  },
  invoiceNumber: {
    fontSize: "16px",
    fontWeight: 700,
  },
  detail: {
    fontSize: "11px",
    color: "#444",
  },
  divider: {
    borderTop: "1px solid #e5e5e5",
    margin: "12px 0",
  },
  addressRow: {
    display: "flex",
    gap: "32px",
    marginBottom: "8px",
  },
  addressBlock: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    color: "#888",
    marginBottom: "4px",
    letterSpacing: "0.5px",
  },
  addressLine: {
    fontSize: "11px",
  },
  contactRow: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap" as const,
    marginBottom: "4px",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginBottom: "4px",
  },
  th: {
    fontSize: "10px",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    color: "#888",
    borderBottom: "2px solid #e5e5e5",
    padding: "6px 4px",
    textAlign: "left" as const,
    letterSpacing: "0.5px",
  },
  td: {
    padding: "8px 4px",
    borderBottom: "1px solid #f0f0f0",
    verticalAlign: "top" as const,
    fontSize: "11px",
  },
  productImage: {
    width: "36px",
    height: "36px",
    objectFit: "cover" as const,
    borderRadius: "4px",
  },
  imagePlaceholder: {
    width: "36px",
    height: "36px",
    background: "#f5f5f5",
    borderRadius: "4px",
    border: "1px solid #e5e5e5",
  },
  itemName: {
    fontWeight: 600,
    fontSize: "11px",
  },
  itemMeta: {
    fontSize: "10px",
    color: "#888",
    marginTop: "1px",
  },
  comparePrice: {
    textDecoration: "line-through",
    color: "#999",
    fontSize: "10px",
  },
  totalsSection: {
    maxWidth: "280px",
    marginLeft: "auto",
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "3px 0",
    fontSize: "11px",
  },
  totalLabel: {
    color: "#666",
  },
  totalValue: {},
  totalLabelBold: {
    fontWeight: 700,
    fontSize: "13px",
  },
  totalValueBold: {
    fontWeight: 700,
    fontSize: "13px",
  },
  totalDivider: {
    borderTop: "1px solid #ccc",
    margin: "6px 0",
  },
  discountReason: {
    fontSize: "10px",
    color: "#888",
    textAlign: "right" as const,
    marginTop: "-2px",
  },
  barcodeSection: {
    textAlign: "center" as const,
    margin: "16px 0",
  },
  barcodePlaceholder: {
    display: "inline-block",
    padding: "16px 24px",
    border: "1px dashed #ccc",
    color: "#999",
    fontSize: "11px",
  },
  notesSection: {
    margin: "12px 0",
    padding: "8px",
    background: "#fafafa",
    borderRadius: "4px",
  },
  noteText: {
    fontSize: "11px",
    color: "#555",
    whiteSpace: "pre-wrap" as const,
  },
  signatureSection: {
    marginTop: "32px",
    textAlign: "center" as const,
    maxWidth: "200px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  signatureLine: {
    borderTop: "1px solid #333",
    marginBottom: "4px",
  },
  signatureLabel: {
    fontSize: "10px",
    color: "#888",
  },
  socialSection: {
    borderTop: "1px solid #e5e5e5",
    marginTop: "16px",
    paddingTop: "8px",
    textAlign: "center" as const,
  },
  socialLinks: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    flexWrap: "wrap" as const,
  },
  socialLink: {
    fontSize: "10px",
    color: "#888",
  },
};
