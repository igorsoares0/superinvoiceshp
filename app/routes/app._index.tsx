import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useLoaderData,
  useActionData,
  useSubmit,
  useNavigation,
  useSearchParams,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop, checkInvoiceLimit, incrementInvoiceCount } from "../services/billing.server";
import { getOrCreateInvoice, updateInvoiceStatus } from "../services/invoice.server";
import { generateInvoicePdf } from "../services/pdf.server";
import { uploadFile, getInvoicePdfKey } from "../services/r2.server";
import { sendInvoiceEmail } from "../services/postmark.server";
import { DEFAULT_TEMPLATE_CONFIG, type TemplateConfig, type OrderData, type ShopData } from "../types/template";
import prisma from "../db.server";

const ORDERS_PER_PAGE = 25;

const ORDERS_QUERY = `#graphql
  query GetOrders($first: Int, $last: Int, $after: String, $before: String) {
    orders(first: $first, last: $last, after: $after, before: $before, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          createdAt
          displayFinancialStatus
          totalPriceSet { shopMoney { amount currencyCode } }
          subtotalPriceSet { shopMoney { amount currencyCode } }
          totalDiscountsSet { shopMoney { amount currencyCode } }
          customer { displayName email }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

const ORDER_DETAIL_QUERY = `#graphql
  query GetOrderDetail($id: ID!) {
    order(id: $id) {
      id
      name
      createdAt
      closedAt
      poNumber
      tags
      note
      displayFinancialStatus
      totalPriceSet { shopMoney { amount currencyCode } }
      subtotalPriceSet { shopMoney { amount currencyCode } }
      totalDiscountsSet { shopMoney { amount currencyCode } }
      totalShippingPriceSet { shopMoney { amount currencyCode } }
      totalTaxSet { shopMoney { amount currencyCode } }
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      customer { displayName email phone }
      billingAddress { formatted }
      shippingAddress { formatted }
      shippingLine {
        title
        originalPriceSet { shopMoney { amount currencyCode } }
      }
      lineItems(first: 50) {
        edges {
          node {
            name
            quantity
            sku
            variant {
              title
              image { url }
              compareAtPrice
              price
            }
            product { productType }
            originalTotalSet { shopMoney { amount currencyCode } }
            discountedTotalSet { shopMoney { amount currencyCode } }
            totalDiscountSet { shopMoney { amount currencyCode } }
            taxLines {
              title
              rate
              priceSet { shopMoney { amount currencyCode } }
            }
          }
        }
      }
      taxLines {
        title
        rate
        priceSet { shopMoney { amount currencyCode } }
      }
      transactions {
        kind
        formattedGateway
      }
    }
  }
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");

  const variables: Record<string, any> = {};
  if (before) {
    variables.last = ORDERS_PER_PAGE;
    variables.before = before;
  } else {
    variables.first = ORDERS_PER_PAGE;
    if (after) variables.after = after;
  }

  const response = await admin.graphql(ORDERS_QUERY, { variables });
  const json = await response.json();
  const ordersData = json.data?.orders;

  const orders = (ordersData?.edges || []).map((edge: any) => {
    const node = edge.node;
    return {
      id: node.id,
      name: node.name,
      createdAt: node.createdAt,
      status: node.displayFinancialStatus,
      customer: node.customer?.displayName || "—",
      customerEmail: node.customer?.email || null,
      subtotal: node.subtotalPriceSet?.shopMoney?.amount || "0.00",
      discount: node.totalDiscountsSet?.shopMoney?.amount || "0.00",
      total: node.totalPriceSet?.shopMoney?.amount || "0.00",
      currency: node.totalPriceSet?.shopMoney?.currencyCode || "USD",
      cursor: edge.cursor,
    };
  });

  const pageInfo = ordersData?.pageInfo || {};

  // Check limits
  const limitCheck = await checkInvoiceLimit(shop.id);

  return {
    orders,
    pageInfo: {
      hasNextPage: pageInfo.hasNextPage || false,
      hasPreviousPage: pageInfo.hasPreviousPage || false,
      startCursor: pageInfo.startCursor || null,
      endCursor: pageInfo.endCursor || null,
    },
    shop: {
      id: shop.id,
      name: shop.name || session.shop.replace(".myshopify.com", ""),
      email: shop.email,
      logoUrl: shop.logoUrl,
    },
    limitCheck,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const orderId = formData.get("orderId") as string;

  // Check limit
  const limitCheck = await checkInvoiceLimit(shop.id);
  if (!limitCheck.allowed) {
    return { error: "Limite de invoices atingido. Faça upgrade do seu plano." };
  }

  // Fetch order details
  const orderResponse = await admin.graphql(ORDER_DETAIL_QUERY, {
    variables: { id: orderId },
  });
  const orderJson = await orderResponse.json();
  const orderNode = orderJson.data?.order;

  if (!orderNode) {
    return { error: "Pedido não encontrado" };
  }

  const money = (set: any) => set?.shopMoney?.amount || "0.00";
  const currency = orderNode.totalPriceSet?.shopMoney?.currencyCode || "USD";

  // Get or create invoice
  const invoice = await getOrCreateInvoice(shop.id, orderId, {
    orderNumber: orderNode.name,
    customerName: orderNode.customer?.displayName || null,
    customerEmail: orderNode.customer?.email || null,
    subtotal: money(orderNode.subtotalPriceSet),
    discount: money(orderNode.totalDiscountsSet),
    total: money(orderNode.totalPriceSet),
    currency,
  });

  // Get template config
  let templateConfig = DEFAULT_TEMPLATE_CONFIG;
  if (invoice.templateId) {
    const template = await prisma.invoiceTemplate.findUnique({
      where: { id: invoice.templateId },
    });
    if (template) {
      templateConfig = template.config as unknown as TemplateConfig;
    }
  }

  // Build order data for PDF
  const orderData = mapOrderNodeToOrderData(orderNode, invoice.invoiceNumber);
  const shopData: ShopData = {
    name: shop.name || session.shop.replace(".myshopify.com", ""),
    email: shop.email,
    logoUrl: shop.logoUrl,
  };

  switch (intent) {
    case "download": {
      // Generate PDF
      const pdfBuffer = await generateInvoicePdf(templateConfig, orderData, shopData);

      // Try uploading to R2, fall back to base64 data URL
      let pdfUrl: string;
      try {
        const key = getInvoicePdfKey(shop.id, invoice.id);
        pdfUrl = await uploadFile(key, pdfBuffer, "application/pdf");
      } catch {
        pdfUrl = `data:application/pdf;base64,${pdfBuffer.toString("base64")}`;
      }

      await updateInvoiceStatus(invoice.id, "draft", { pdfUrl: pdfUrl.startsWith("data:") ? null : pdfUrl });
      await incrementInvoiceCount(shop.id);

      return { success: "PDF gerado", pdfUrl };
    }

    case "send": {
      if (!orderNode.customer?.email) {
        return { error: "Pedido não tem email de cliente" };
      }

      // Generate PDF
      const pdfBuffer = await generateInvoicePdf(templateConfig, orderData, shopData);

      // Try uploading to R2
      let pdfUrl: string | null = null;
      try {
        const key = getInvoicePdfKey(shop.id, invoice.id);
        pdfUrl = await uploadFile(key, pdfBuffer, "application/pdf");
      } catch {
        // R2 not configured, continue without stored URL
      }

      // Send email
      await sendInvoiceEmail({
        to: orderNode.customer.email,
        fromEmail: shop.email || undefined,
        shopName: shopData.name,
        invoiceNumber: invoice.invoiceNumber,
        pdfBuffer,
      });

      await updateInvoiceStatus(invoice.id, "sent", {
        pdfUrl,
        sentAt: new Date(),
      });
      await incrementInvoiceCount(shop.id);

      return { success: `Invoice enviada para ${orderNode.customer.email}` };
    }

    default:
      return { error: "Ação desconhecida" };
  }
};

export default function Index() {
  const { orders, pageInfo, limitCheck } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();
  const actionData = useActionData<typeof action>();
  const [searchQuery, setSearchQuery] = useState("");

  const submittingOrderId =
    navigation.state === "submitting"
      ? new URLSearchParams(navigation.formData as any).get("orderId")
      : null;
  const submittingIntent =
    navigation.state === "submitting"
      ? new URLSearchParams(navigation.formData as any).get("intent")
      : null;

  const handleAction = (intent: string, orderId: string) => {
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("orderId", orderId);
    submit(formData, { method: "POST" });
  };

  useEffect(() => {
    if (!actionData) return;
    if (actionData.pdfUrl) window.open(actionData.pdfUrl, "_blank");
    if (actionData.success) shopify.toast.show(actionData.success);
    if (actionData.error) shopify.toast.show(actionData.error, { isError: true });
  }, [actionData]);

  // Client-side search
  const filteredOrders = searchQuery
    ? orders.filter((o: any) =>
        o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : orders;

  // KPI stats
  const usagePercent = limitCheck.limit
    ? Math.min(Math.round((limitCheck.current / limitCheck.limit) * 100), 100)
    : 0;
  const paidCount = orders.filter((o: any) => o.status === "PAID").length;
  const pendingCount = orders.filter((o: any) =>
    ["PENDING", "PARTIALLY_PAID", "AUTHORIZED"].includes(o.status)
  ).length;
  const totalValue = orders.reduce((sum: number, o: any) => sum + Number(o.total), 0);
  const currency = orders[0]?.currency || "BRL";

  return (
    <s-page heading="Pedidos">
      {!limitCheck.allowed && (
        <s-banner tone="critical">
          Limite de {limitCheck.limit} invoices atingido neste ciclo.{" "}
          <s-link href="/app/pricing">Faça upgrade do seu plano</s-link>.
        </s-banner>
      )}
      {limitCheck.allowed && limitCheck.limit !== null && limitCheck.current / limitCheck.limit >= 0.8 && (
        <s-banner tone="warning">
          Você usou {limitCheck.current} de {limitCheck.limit} invoices neste ciclo ({Math.round((limitCheck.current / limitCheck.limit) * 100)}%).
        </s-banner>
      )}

      <s-layout>
        <s-layout-section>
          <s-stack direction="block" gap="base">
            {/* Dashboard KPI Cards */}
            <div style={kpiRowStyle}>
              <div style={kpiCardStyle}>
                <s-stack direction="block" gap="tight">
                  <span style={kpiLabelStyle}>Invoices no ciclo</span>
                  <s-stack direction="inline" gap="tight" blockAlign="end">
                    <s-text variant="headingLg" fontWeight="bold">
                      {limitCheck.current}
                    </s-text>
                    {limitCheck.limit !== null && (
                      <span style={kpiSecondaryStyle}>/ {limitCheck.limit}</span>
                    )}
                  </s-stack>
                  {limitCheck.limit !== null ? (
                    <s-progress-bar
                      progress={usagePercent}
                      size="small"
                      {...(usagePercent >= 80 ? { tone: "critical" } : {})}
                    />
                  ) : (
                    <span style={kpiSecondaryStyle}>Ilimitado</span>
                  )}
                </s-stack>
              </div>

              <div style={kpiCardStyle}>
                <s-stack direction="block" gap="tight">
                  <span style={kpiLabelStyle}>Pedidos</span>
                  <s-text variant="headingLg" fontWeight="bold">
                    {orders.length}
                  </s-text>
                  <s-stack direction="inline" gap="tight">
                    {paidCount > 0 && (
                      <s-badge tone="success">{paidCount} pagos</s-badge>
                    )}
                    {pendingCount > 0 && (
                      <s-badge tone="warning">{pendingCount} pendentes</s-badge>
                    )}
                  </s-stack>
                </s-stack>
              </div>

              <div style={kpiCardStyle}>
                <s-stack direction="block" gap="tight">
                  <span style={kpiLabelStyle}>Valor total</span>
                  <s-text variant="headingLg" fontWeight="bold">
                    {formatMoney(totalValue.toFixed(2), currency)}
                  </s-text>
                  <span style={kpiSecondaryStyle}>
                    {orders.length} pedidos nesta página
                  </span>
                </s-stack>
              </div>
            </div>

            {/* Orders Card */}
            {orders.length === 0 ? (
              <div style={whiteCardStyle}>
                <div style={{ padding: "40px 20px", textAlign: "center" }}>
                  <s-stack direction="block" gap="base" align="center">
                    <div style={{ fontSize: "48px", lineHeight: "1" }}>📋</div>
                    <s-heading>Nenhum pedido encontrado</s-heading>
                    <s-paragraph>
                      Quando sua loja receber pedidos, eles aparecerão aqui para gerar invoices.
                    </s-paragraph>
                  </s-stack>
                </div>
              </div>
            ) : (
              <div style={whiteCardStyle}>
                <style>{`
                  .si-order-row:hover { background-color: #f6f6f7; }
                  .si-order-row { transition: background-color 0.15s ease; }
                `}</style>

                {/* Search */}
                <div style={searchBarStyle}>
                  <s-text-field
                    label="Buscar pedidos"
                    labelAccessibilityVisibility="hidden"
                    placeholder="Buscar por número do pedido ou cliente..."
                    value={searchQuery}
                    onInput={(e: Event) =>
                      setSearchQuery((e.target as HTMLInputElement).value)
                    }
                  />
                </div>

                {/* Table */}
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={headerRowStyle}>
                      <th style={thStyle}>Pedido</th>
                      <th style={thStyle}>Cliente</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Subtotal</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Desconto</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Status</th>
                      <th style={{ ...thStyle, textAlign: "center" }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={emptySearchStyle}>
                          Nenhum resultado para &ldquo;{searchQuery}&rdquo;
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order: any) => {
                        const isThisOrder = submittingOrderId === order.id;
                        return (
                          <tr key={order.id} className="si-order-row" style={rowStyle}>
                            <td style={tdStyle}>
                              <strong style={{ fontSize: "13px", color: "#202223" }}>
                                {order.name}
                              </strong>
                              <div style={{ fontSize: "11px", color: "#8c9196", marginTop: "2px" }}>
                                {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ color: "#202223" }}>{order.customer}</span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              {formatMoney(order.subtotal, order.currency)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>
                              <span style={{ color: Number(order.discount) > 0 ? "#d72c0d" : "#8c9196" }}>
                                {Number(order.discount) > 0
                                  ? `-${formatMoney(order.discount, order.currency)}`
                                  : "—"}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: "#202223" }}>
                              {formatMoney(order.total, order.currency)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <StatusBadge status={order.status} />
                            </td>
                            <td style={{ ...tdStyle, textAlign: "center" }}>
                              <s-stack direction="inline" gap="tight" align="center">
                                <s-button
                                  variant="tertiary"
                                  size="slim"
                                  onClick={() => handleAction("download", order.id)}
                                  {...(isThisOrder && submittingIntent === "download"
                                    ? { loading: true }
                                    : {})}
                                  {...((!limitCheck.allowed || (isThisOrder && submittingIntent !== "download"))
                                    ? { disabled: true }
                                    : {})}
                                >
                                  Gerar PDF
                                </s-button>
                                <s-button
                                  variant="tertiary"
                                  size="slim"
                                  onClick={() => handleAction("send", order.id)}
                                  {...(isThisOrder && submittingIntent === "send"
                                    ? { loading: true }
                                    : {})}
                                  {...((!limitCheck.allowed || !order.customerEmail || (isThisOrder && submittingIntent !== "send"))
                                    ? { disabled: true }
                                    : {})}
                                >
                                  Enviar
                                </s-button>
                              </s-stack>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

                {/* Pagination */}
                {(pageInfo.hasPreviousPage || pageInfo.hasNextPage) && (
                  <div style={paginationStyle}>
                    <s-stack direction="inline" gap="base" align="center">
                      <s-button
                        variant="tertiary"
                        {...(!pageInfo.hasPreviousPage ? { disabled: true } : {})}
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (pageInfo.startCursor) params.set("before", pageInfo.startCursor);
                          setSearchParams(params);
                        }}
                      >
                        ← Anterior
                      </s-button>
                      <s-button
                        variant="tertiary"
                        {...(!pageInfo.hasNextPage ? { disabled: true } : {})}
                        onClick={() => {
                          const params = new URLSearchParams();
                          if (pageInfo.endCursor) params.set("after", pageInfo.endCursor);
                          setSearchParams(params);
                        }}
                      >
                        Próximo →
                      </s-button>
                    </s-stack>
                  </div>
                )}
              </div>
            )}
          </s-stack>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: string; label: string }> = {
    PAID: { tone: "success", label: "Pago" },
    PARTIALLY_PAID: { tone: "warning", label: "Parcial" },
    PENDING: { tone: "warning", label: "Pendente" },
    AUTHORIZED: { tone: "info", label: "Autorizado" },
    REFUNDED: { tone: "critical", label: "Reembolsado" },
    PARTIALLY_REFUNDED: { tone: "warning", label: "Reembolso parcial" },
    VOIDED: { tone: "neutral", label: "Cancelado" },
  };
  const info = map[status] || { tone: "neutral" as const, label: status };
  return <s-badge tone={info.tone as any}>{info.label}</s-badge>;
}

function formatMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

// Map GraphQL order to OrderData for PDF generation
function mapOrderNodeToOrderData(node: any, invoiceNumber: string) {
  const money = (set: any) => set?.shopMoney?.amount || "0.00";
  const currency = (set: any) => set?.shopMoney?.currencyCode || "USD";

  const lineItems = (node.lineItems?.edges || []).map((edge: any) => {
    const li = edge.node;
    const variant = li.variant;
    const itemTax = (li.taxLines || []).reduce(
      (sum: number, t: any) => sum + Number(money(t.priceSet)),
      0,
    );
    return {
      name: li.name,
      quantity: li.quantity,
      sku: li.sku || variant?.sku || null,
      weight: null,
      variant: variant?.title !== "Default Title" ? variant?.title : null,
      productType: li.product?.productType || null,
      imageUrl: variant?.image?.url || null,
      price: variant?.price || "0.00",
      compareAtPrice: variant?.compareAtPrice || null,
      discount: money(li.totalDiscountSet),
      discountReason: null,
      priceAfterDiscount: (
        Number(variant?.price || 0) - Number(money(li.totalDiscountSet))
      ).toFixed(2),
      taxTotal: itemTax.toFixed(2),
      total: money(li.originalTotalSet),
    };
  });

  const taxLines = (node.taxLines || []).map((t: any) => ({
    title: t.title,
    rate: `${(Number(t.rate) * 100).toFixed(1)}%`,
    amount: money(t.priceSet),
  }));

  const txList = node.transactions || [];
  const gateway =
    txList.find((t: any) => t.kind === "SALE")?.formattedGateway ||
    txList[0]?.formattedGateway ||
    null;

  return {
    id: node.id,
    name: node.name,
    orderNumber: node.name.replace("#", ""),
    invoiceNumber,
    poNumber: node.poNumber || null,
    createdAt: node.createdAt,
    closedAt: node.closedAt || null,
    tags: node.tags || [],
    financialStatus: node.displayFinancialStatus || "PENDING",
    customer: node.customer
      ? {
          name: node.customer.displayName,
          email: node.customer.email,
          phone: node.customer.phone,
        }
      : null,
    billingAddress: node.billingAddress
      ? { formatted: node.billingAddress.formatted }
      : null,
    shippingAddress: node.shippingAddress
      ? { formatted: node.shippingAddress.formatted }
      : null,
    paymentMethod: gateway,
    creditCard: null,
    shippingLine: node.shippingLine
      ? {
          title: node.shippingLine.title,
          price: money(node.shippingLine.originalPriceSet),
        }
      : null,
    lineItems,
    subtotal: money(node.subtotalPriceSet),
    totalDiscount: money(node.totalDiscountsSet),
    discountReason: null,
    shippingTotal: money(node.totalShippingPriceSet),
    shippingRateName: node.shippingLine?.title || null,
    taxTotal: money(node.totalTaxSet),
    taxLines,
    duties: "0.00",
    total: money(node.totalPriceSet),
    paidByCustomer: money(node.totalPriceSet),
    refundAmount: (Number(money(node.totalPriceSet)) - Number(money(node.currentTotalPriceSet))).toFixed(2),
    netPayment: money(node.currentTotalPriceSet),
    balance: "0.00",
    note: node.note || null,
    currency: currency(node.totalPriceSet),
  };
}

const kpiRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};
const kpiCardStyle: React.CSSProperties = {
  flex: "1 1 200px",
  background: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e1e3e5",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
  padding: "16px 20px",
};
const whiteCardStyle: React.CSSProperties = {
  background: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e1e3e5",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
  overflow: "hidden",
};
const kpiLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#6d7175",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  fontWeight: 600,
};
const kpiSecondaryStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#8c9196",
};
const searchBarStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderBottom: "1px solid #e1e3e5",
};
const headerRowStyle: React.CSSProperties = {
  borderBottom: "1px solid #c9cccf",
  backgroundColor: "#f6f6f7",
};
const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#6d7175",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};
const rowStyle: React.CSSProperties = {
  borderBottom: "1px solid #f1f2f4",
};
const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  verticalAlign: "middle",
  color: "#202223",
};
const emptySearchStyle: React.CSSProperties = {
  padding: "32px",
  textAlign: "center",
  color: "#8c9196",
  fontSize: "14px",
};
const paginationStyle: React.CSSProperties = {
  padding: "12px 16px",
  display: "flex",
  justifyContent: "center",
  borderTop: "1px solid #e1e3e5",
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
