import { useState, useCallback } from "react";
import type { TemplateConfig } from "../types/template";

interface TemplateEditorProps {
  config: TemplateConfig;
  onChange: (config: TemplateConfig) => void;
}

export function TemplateEditor({ config, onChange }: TemplateEditorProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    orderInfo: true,
    paymentInfo: false,
    shippingInfo: false,
    itemProduct: false,
    itemPricing: false,
    itemQuantity: false,
    totalsSummary: false,
    totalsShipping: false,
    totalsTax: false,
    totalsPayment: false,
    barcode: false,
    notes: false,
    social: false,
  });

  const toggle = useCallback((section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  // Helper to set a nested boolean field
  const setField = useCallback(
    (path: string, value: boolean | string) => {
      const keys = path.split(".");
      const updated = structuredClone(config);
      let obj: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      onChange(updated);
    },
    [config, onChange],
  );

  const getField = (path: string): any => {
    const keys = path.split(".");
    let obj: any = config;
    for (const key of keys) {
      obj = obj[key];
    }
    return obj;
  };

  return (
    <div style={editorStyles.container}>
      {/* Informações do Pedido */}
      <Section
        title="Informações do Pedido"
        open={openSections.orderInfo}
        onToggle={() => toggle("orderInfo")}
      >
        <Checkbox
          label="Número do pedido"
          checked={config.orderInfo.showOrderNumber}
          onChange={(v) => setField("orderInfo.showOrderNumber", v)}
        />
        <Checkbox
          label="Número da fatura"
          checked={config.orderInfo.showInvoiceNumber}
          onChange={(v) => setField("orderInfo.showInvoiceNumber", v)}
        />
        <Checkbox
          label="Purchase order number"
          checked={config.orderInfo.showPurchaseOrderNumber}
          onChange={(v) => setField("orderInfo.showPurchaseOrderNumber", v)}
        />
        <Checkbox
          label="Data do pedido"
          checked={config.orderInfo.showOrderDate}
          onChange={(v) => setField("orderInfo.showOrderDate", v)}
        />
        <Checkbox
          label="Data de fechamento"
          checked={config.orderInfo.showClosingDate}
          onChange={(v) => setField("orderInfo.showClosingDate", v)}
        />
        <Checkbox
          label="Valor do pedido"
          checked={config.orderInfo.showOrderValue}
          onChange={(v) => setField("orderInfo.showOrderValue", v)}
        />
        <Checkbox
          label="Etiquetas do pedido"
          checked={config.orderInfo.showOrderTags}
          onChange={(v) => setField("orderInfo.showOrderTags", v)}
        />
      </Section>

      {/* Informações de Pagamento */}
      <Section
        title="Informações de Pagamento"
        open={openSections.paymentInfo}
        onToggle={() => toggle("paymentInfo")}
      >
        <Checkbox
          label="Endereço de pagamento"
          checked={config.paymentInfo.showBillingAddress}
          onChange={(v) => setField("paymentInfo.showBillingAddress", v)}
        />
        <Checkbox
          label="Método de pagamento"
          checked={config.paymentInfo.showPaymentMethod}
          onChange={(v) => setField("paymentInfo.showPaymentMethod", v)}
        />
        <Checkbox
          label="Cartão de crédito"
          checked={config.paymentInfo.showCreditCard}
          onChange={(v) => setField("paymentInfo.showCreditCard", v)}
        />
      </Section>

      {/* Informações de Envio */}
      <Section
        title="Informações de Envio"
        open={openSections.shippingInfo}
        onToggle={() => toggle("shippingInfo")}
      >
        <Checkbox
          label="Endereço de envio"
          checked={config.shippingInfo.showShippingAddress}
          onChange={(v) => setField("shippingInfo.showShippingAddress", v)}
        />
        <Checkbox
          label="Email do cliente"
          checked={config.shippingInfo.showCustomerEmail}
          onChange={(v) => setField("shippingInfo.showCustomerEmail", v)}
        />
        <Checkbox
          label="Telefone do cliente"
          checked={config.shippingInfo.showCustomerPhone}
          onChange={(v) => setField("shippingInfo.showCustomerPhone", v)}
        />
      </Section>

      {/* Informações dos Itens */}
      <Section
        title="Itens — Detalhes do Produto"
        open={openSections.itemProduct}
        onToggle={() => toggle("itemProduct")}
      >
        <Checkbox
          label="Imagem do produto"
          checked={config.itemDetails.product.showImage}
          onChange={(v) => setField("itemDetails.product.showImage", v)}
        />
        <Checkbox
          label="SKU do produto"
          checked={config.itemDetails.product.showSku}
          onChange={(v) => setField("itemDetails.product.showSku", v)}
        />
        <Checkbox
          label="Peso do produto"
          checked={config.itemDetails.product.showWeight}
          onChange={(v) => setField("itemDetails.product.showWeight", v)}
        />
        <Checkbox
          label="Variante do produto"
          checked={config.itemDetails.product.showVariant}
          onChange={(v) => setField("itemDetails.product.showVariant", v)}
        />
        <Checkbox
          label="Tipo do produto"
          checked={config.itemDetails.product.showProductType}
          onChange={(v) => setField("itemDetails.product.showProductType", v)}
        />
      </Section>

      <Section
        title="Itens — Preços e Descontos"
        open={openSections.itemPricing}
        onToggle={() => toggle("itemPricing")}
      >
        <Checkbox
          label="Mostrar desconto"
          checked={config.itemDetails.pricing.showDiscount}
          onChange={(v) => setField("itemDetails.pricing.showDiscount", v)}
        />
        <Checkbox
          label="Mostrar motivo do desconto"
          checked={config.itemDetails.pricing.showDiscountReason}
          onChange={(v) => setField("itemDetails.pricing.showDiscountReason", v)}
        />
        <Checkbox
          label="Preço de comparação"
          checked={config.itemDetails.pricing.showCompareAtPrice}
          onChange={(v) => setField("itemDetails.pricing.showCompareAtPrice", v)}
        />
        <Checkbox
          label="Preço sem incluir impostos"
          checked={config.itemDetails.pricing.showPriceExcludingTax}
          onChange={(v) => setField("itemDetails.pricing.showPriceExcludingTax", v)}
        />
        <Checkbox
          label="Preço após desconto"
          checked={config.itemDetails.pricing.showPriceAfterDiscount}
          onChange={(v) => setField("itemDetails.pricing.showPriceAfterDiscount", v)}
        />
      </Section>

      <Section
        title="Itens — Quantidade e Impostos"
        open={openSections.itemQuantity}
        onToggle={() => toggle("itemQuantity")}
      >
        <Checkbox
          label="Quantidade total"
          checked={config.itemDetails.quantity.showTotalQuantity}
          onChange={(v) => setField("itemDetails.quantity.showTotalQuantity", v)}
        />
        <Checkbox
          label="Imposto total do item"
          checked={config.itemDetails.quantity.showItemTotalTax}
          onChange={(v) => setField("itemDetails.quantity.showItemTotalTax", v)}
        />
      </Section>

      {/* Totais */}
      <Section
        title="Totais — Resumo do Pedido"
        open={openSections.totalsSummary}
        onToggle={() => toggle("totalsSummary")}
      >
        <Checkbox
          label="Subtotal do pedido"
          checked={config.orderTotals.summary.showSubtotal}
          onChange={(v) => setField("orderTotals.summary.showSubtotal", v)}
        />
        <Checkbox
          label="Desconto do pedido"
          checked={config.orderTotals.summary.showDiscount}
          onChange={(v) => setField("orderTotals.summary.showDiscount", v)}
        />
        <Checkbox
          label="Motivo do desconto"
          checked={config.orderTotals.summary.showDiscountReason}
          onChange={(v) => setField("orderTotals.summary.showDiscountReason", v)}
        />
      </Section>

      <Section
        title="Totais — Envio"
        open={openSections.totalsShipping}
        onToggle={() => toggle("totalsShipping")}
      >
        <Checkbox
          label="Envio do pedido"
          checked={config.orderTotals.shipping.showShipping}
          onChange={(v) => setField("orderTotals.shipping.showShipping", v)}
        />
        <Checkbox
          label="Nome da taxa de envio"
          checked={config.orderTotals.shipping.showShippingRateName}
          onChange={(v) => setField("orderTotals.shipping.showShippingRateName", v)}
        />
      </Section>

      <Section
        title="Totais — Impostos"
        open={openSections.totalsTax}
        onToggle={() => toggle("totalsTax")}
      >
        <Checkbox
          label="Impostos (excluindo)"
          checked={config.orderTotals.tax.showExcludingTax}
          onChange={(v) => setField("orderTotals.tax.showExcludingTax", v)}
        />
        <Checkbox
          label="Duties"
          checked={config.orderTotals.tax.showDuties}
          onChange={(v) => setField("orderTotals.tax.showDuties", v)}
        />
        <Checkbox
          label="Informações"
          checked={config.orderTotals.tax.showInfo}
          onChange={(v) => setField("orderTotals.tax.showInfo", v)}
        />
        <Checkbox
          label="Premium"
          checked={config.orderTotals.tax.showPremium}
          onChange={(v) => setField("orderTotals.tax.showPremium", v)}
        />
        <Checkbox
          label="Rótulo IMPOSTO/IVA/GST"
          checked={config.orderTotals.tax.showTaxLabel}
          onChange={(v) => setField("orderTotals.tax.showTaxLabel", v)}
        />
        <Checkbox
          label="Agrupar linhas de imposto"
          checked={config.orderTotals.tax.groupTaxLines}
          onChange={(v) => setField("orderTotals.tax.groupTaxLines", v)}
        />
      </Section>

      <Section
        title="Totais — Pagamento"
        open={openSections.totalsPayment}
        onToggle={() => toggle("totalsPayment")}
      >
        <Checkbox
          label="Pago pelo cliente"
          checked={config.orderTotals.payment.showPaidByCustomer}
          onChange={(v) => setField("orderTotals.payment.showPaidByCustomer", v)}
        />
        <Checkbox
          label="Valor do reembolso"
          checked={config.orderTotals.payment.showRefundAmount}
          onChange={(v) => setField("orderTotals.payment.showRefundAmount", v)}
        />
        <Checkbox
          label="Pagamento líquido"
          checked={config.orderTotals.payment.showNetPayment}
          onChange={(v) => setField("orderTotals.payment.showNetPayment", v)}
        />
        <Checkbox
          label="Saldo"
          checked={config.orderTotals.payment.showBalance}
          onChange={(v) => setField("orderTotals.payment.showBalance", v)}
        />
      </Section>

      {/* Informações Adicionais */}
      <Section
        title="Código de Barras"
        open={openSections.barcode}
        onToggle={() => toggle("barcode")}
      >
        <Checkbox
          label="Código de barras do pedido"
          checked={config.additional.barcode.showBarcode}
          onChange={(v) => setField("additional.barcode.showBarcode", v)}
        />
        {config.additional.barcode.showBarcode && (
          <div style={editorStyles.selectRow}>
            <label style={editorStyles.selectLabel}>Tipo:</label>
            <select
              value={config.additional.barcode.barcodeType}
              onChange={(e) =>
                setField("additional.barcode.barcodeType", e.target.value)
              }
              style={editorStyles.select}
            >
              <option value="qrcode">QR Code</option>
              <option value="code128">Barcode (Code 128)</option>
              <option value="code39">Barcode (Code 39)</option>
            </select>
          </div>
        )}
      </Section>

      <Section
        title="Informações Adicionais"
        open={openSections.notes}
        onToggle={() => toggle("notes")}
      >
        <Checkbox
          label="Notas do pedido"
          checked={config.additional.notes.showOrderNotes}
          onChange={(v) => setField("additional.notes.showOrderNotes", v)}
        />
        <Checkbox
          label="Notas de rodapé"
          checked={config.additional.notes.showFooterNotes}
          onChange={(v) => setField("additional.notes.showFooterNotes", v)}
        />
        {config.additional.notes.showFooterNotes && (
          <div style={editorStyles.textFieldRow}>
            <textarea
              value={config.additional.notes.footerNotesText}
              onChange={(e) =>
                setField("additional.notes.footerNotesText", e.target.value)
              }
              placeholder="Texto do rodapé..."
              style={editorStyles.textarea}
              rows={3}
            />
          </div>
        )}
        <Checkbox
          label="Assinatura"
          checked={config.additional.notes.showSignature}
          onChange={(v) => setField("additional.notes.showSignature", v)}
        />
      </Section>

      {/* Social Media */}
      <Section
        title="Redes Sociais"
        open={openSections.social}
        onToggle={() => toggle("social")}
      >
        <TextInput
          label="Facebook"
          value={config.socialMedia.facebook}
          onChange={(v) => setField("socialMedia.facebook", v)}
          placeholder="facebook.com/suapagina"
        />
        <TextInput
          label="Instagram"
          value={config.socialMedia.instagram}
          onChange={(v) => setField("socialMedia.instagram", v)}
          placeholder="@suaconta"
        />
        <TextInput
          label="Twitter / X"
          value={config.socialMedia.twitter}
          onChange={(v) => setField("socialMedia.twitter", v)}
          placeholder="@suaconta"
        />
        <TextInput
          label="LinkedIn"
          value={config.socialMedia.linkedin}
          onChange={(v) => setField("socialMedia.linkedin", v)}
          placeholder="linkedin.com/company/suaempresa"
        />
        <TextInput
          label="Website"
          value={config.socialMedia.website}
          onChange={(v) => setField("socialMedia.website", v)}
          placeholder="www.seusite.com"
        />
      </Section>
    </div>
  );
}

// --- Sub-components ---

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={editorStyles.section}>
      <button
        onClick={onToggle}
        style={editorStyles.sectionHeader}
        type="button"
      >
        <span style={editorStyles.sectionArrow}>{open ? "▼" : "▶"}</span>
        <span style={editorStyles.sectionTitle}>{title}</span>
      </button>
      {open && (
        <div style={editorStyles.sectionContent}>{children}</div>
      )}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label style={editorStyles.checkboxRow}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={editorStyles.checkbox}
      />
      <span style={editorStyles.checkboxLabel}>{label}</span>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div style={editorStyles.textFieldRow}>
      <label style={editorStyles.textFieldLabel}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={editorStyles.textField}
      />
    </div>
  );
}

const editorStyles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    fontSize: "13px",
  },
  section: {
    borderBottom: "1px solid #e5e5e5",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    width: "100%",
    border: "none",
    background: "#fafafa",
    cursor: "pointer",
    textAlign: "left",
    fontSize: "13px",
    fontWeight: 600,
    color: "#333",
  },
  sectionArrow: {
    fontSize: "10px",
    width: "14px",
    color: "#888",
  },
  sectionTitle: {},
  sectionContent: {
    padding: "8px 12px 12px 34px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    padding: "2px 0",
  },
  checkbox: {
    width: "16px",
    height: "16px",
    cursor: "pointer",
    accentColor: "#008060",
  },
  checkboxLabel: {
    fontSize: "13px",
    color: "#333",
    userSelect: "none",
  },
  selectRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginTop: "4px",
    paddingLeft: "24px",
  },
  selectLabel: {
    fontSize: "12px",
    color: "#666",
  },
  select: {
    fontSize: "12px",
    padding: "4px 8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    background: "#fff",
  },
  textFieldRow: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    marginTop: "4px",
  },
  textFieldLabel: {
    fontSize: "12px",
    color: "#666",
    fontWeight: 500,
  },
  textField: {
    fontSize: "12px",
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    background: "#fff",
    width: "100%",
    boxSizing: "border-box",
  },
  textarea: {
    fontSize: "12px",
    padding: "6px 8px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    background: "#fff",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
    resize: "vertical",
  },
};
