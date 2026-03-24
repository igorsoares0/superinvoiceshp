import { useEffect } from "react";
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
  const isSubmitting = navigation.state === "submitting";

  const submittingOrderId =
    navigation.state === "submitting"
      ? new URLSearchParams(navigation.formData as any).get("orderId")
      : null;

  const handleAction = (intent: string, orderId: string) => {
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("orderId", orderId);
    submit(formData, { method: "POST" });
  };

  // Open PDF or show toast when action completes
  useEffect(() => {
    if (!actionData) return;
    if (actionData.pdfUrl) {
      window.open(actionData.pdfUrl, "_blank");
    }
    if (actionData.success) {
      shopify.toast.show(actionData.success);
    }
    if (actionData.error) {
      shopify.toast.show(actionData.error, { isError: true });
    }
  }, [actionData]);

  return (
    <s-page heading="Pedidos">
      {!limitCheck.allowed && (
        <s-banner tone="critical">
          Limite de {limitCheck.limit} invoices atingido neste ciclo.
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
          {orders.length === 0 ? (
            <s-card>
              <s-box padding="loose">
                <s-stack direction="block" gap="base" align="center">
                  <s-heading>Nenhum pedido encontrado</s-heading>
                  <s-paragraph>
                    Quando sua loja receber pedidos, eles aparecerão aqui.
                  </s-paragraph>
                </s-stack>
              </s-box>
            </s-card>
          ) : (
            <s-card>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={thRowStyle}>
                    <th style={thStyle}>Pedido</th>
                    <th style={thStyle}>Cliente</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Subtotal</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Desconto</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order: any) => {
                    const isThisSubmitting = submittingOrderId === order.id;
                    return (
                      <tr key={order.id} style={trStyle}>
                        <td style={tdStyle}>
                          <strong>{order.name}</strong>
                          <div style={{ fontSize: "11px", color: "#666" }}>
                            {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                          </div>
                        </td>
                        <td style={tdStyle}>{order.customer}</td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {formatMoney(order.subtotal, order.currency)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {Number(order.discount) > 0
                            ? `-${formatMoney(order.discount, order.currency)}`
                            : "—"}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                          {formatMoney(order.total, order.currency)}
                        </td>
                        <td style={tdStyle}>
                          <StatusBadge status={order.status} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <s-stack direction="inline" gap="tight">
                            <s-button
                              variant="tertiary"
                              size="slim"
                              onClick={() => handleAction("download", order.id)}
                              {...(isThisSubmitting ? { loading: true } : {})}
                              {...(!limitCheck.allowed ? { disabled: true } : {})}
                            >
                              PDF
                            </s-button>
                            <s-button
                              variant="tertiary"
                              size="slim"
                              onClick={() => handleAction("send", order.id)}
                              {...(isThisSubmitting ? { loading: true } : {})}
                              {...(!limitCheck.allowed || !order.customerEmail
                                ? { disabled: true }
                                : {})}
                            >
                              Email
                            </s-button>
                          </s-stack>
                        </td>
                      </tr>
                    );
                  })}
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
            </s-card>
          )}
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

const thRowStyle: React.CSSProperties = {
  borderBottom: "2px solid #e5e5e5",
};
const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#666",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};
const trStyle: React.CSSProperties = {
  borderBottom: "1px solid #f0f0f0",
};
const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "13px",
  verticalAlign: "middle",
};
const paginationStyle: React.CSSProperties = {
  padding: "12px",
  display: "flex",
  justifyContent: "center",
  borderTop: "1px solid #e5e5e5",
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
