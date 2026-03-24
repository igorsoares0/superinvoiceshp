import { useState, useCallback, useEffect, useRef } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useLoaderData,
  useSubmit,
  useNavigation,
  useNavigate,
  redirect,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { getOrCreateShop } from "../services/billing.server";
import { InvoicePreview } from "../components/InvoicePreview";
import { TemplateEditor } from "../components/TemplateEditor";
import {
  DEFAULT_TEMPLATE_CONFIG,
  SAMPLE_ORDER,
  type TemplateConfig,
  type OrderData,
  type ShopData,
} from "../types/template";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const { id } = params;

  let template;
  if (id === "new") {
    template = {
      id: "new",
      name: "Novo Template",
      config: DEFAULT_TEMPLATE_CONFIG,
    };
  } else {
    const found = await prisma.invoiceTemplate.findUnique({
      where: { id },
    });
    if (!found || found.shopId !== shop.id) {
      throw redirect("/app/templates");
    }
    template = {
      id: found.id,
      name: found.name,
      config: found.config as unknown as TemplateConfig,
    };
  }

  // Fetch a sample order from the shop for preview
  let sampleOrder: OrderData = SAMPLE_ORDER;
  try {
    const response = await admin.graphql(
      `#graphql
        query GetSampleOrder {
          orders(first: 1, sortKey: CREATED_AT, reverse: true) {
            edges {
              node {
                id
                name
                createdAt
                closedAt
                poNumber
                tags
                displayFinancialStatus
                note
                totalPriceSet { shopMoney { amount currencyCode } }
                subtotalPriceSet { shopMoney { amount currencyCode } }
                totalDiscountsSet { shopMoney { amount currencyCode } }
                totalShippingPriceSet { shopMoney { amount currencyCode } }
                totalTaxSet { shopMoney { amount currencyCode } }
                currentTotalPriceSet { shopMoney { amount currencyCode } }
                customer {
                  displayName
                  email
                  phone
                }
                billingAddress { formatted }
                shippingAddress { formatted }
                shippingLine {
                  title
                  originalPriceSet { shopMoney { amount currencyCode } }
                }
                lineItems(first: 10) {
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
          }
        }
      `,
    );
    const json = await response.json();
    const orderNode = json.data?.orders?.edges?.[0]?.node;
    if (orderNode) {
      sampleOrder = mapShopifyOrderToOrderData(orderNode);
    }
  } catch {
    // Use default sample order on error
  }

  const shopData: ShopData = {
    name: shop.name || session.shop.replace(".myshopify.com", ""),
    email: shop.email,
    logoUrl: shop.logoUrl,
  };

  return { template, sampleOrder, shop: shopData };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const { id } = params;

  const name = formData.get("name") as string;
  const configStr = formData.get("config") as string;
  const config = JSON.parse(configStr);

  if (id === "new") {
    const template = await prisma.invoiceTemplate.create({
      data: {
        shopId: shop.id,
        name: name || "Novo Template",
        config,
        isDefault: false,
      },
    });
    return redirect(`/app/template/${template.id}`);
  }

  await prisma.invoiceTemplate.update({
    where: { id },
    data: { name, config },
  });

  return { success: "Template salvo com sucesso" };
};

export default function TemplateEditorPage() {
  const { template, sampleOrder, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const isSubmitting = navigation.state === "submitting";

  const [config, setConfig] = useState<TemplateConfig>(
    template.config as TemplateConfig,
  );
  const [name, setName] = useState(template.name);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced config updates for text fields
  const handleConfigChange = useCallback((newConfig: TemplateConfig) => {
    setConfig(newConfig);
  }, []);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("config", JSON.stringify(config));
    submit(formData, { method: "POST" });
    shopify.toast.show("Template salvo");
  }, [name, config, submit, shopify]);

  return (
    <div style={pageStyles.wrapper}>
      {/* Top Bar */}
      <div style={pageStyles.topBar}>
        <div style={pageStyles.topBarLeft}>
          <button
            onClick={() => navigate("/app/templates")}
            style={pageStyles.backButton}
            type="button"
          >
            ← Templates
          </button>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={pageStyles.nameInput}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          style={pageStyles.saveButton}
          type="button"
        >
          {isSubmitting ? "Salvando..." : "Salvar"}
        </button>
      </div>

      {/* Split View */}
      <div style={pageStyles.splitContainer}>
        {/* Left: Editor */}
        <div style={pageStyles.editorPanel}>
          <TemplateEditor config={config} onChange={handleConfigChange} />
        </div>

        {/* Right: Preview */}
        <div style={pageStyles.previewPanel}>
          <div style={pageStyles.previewHeader}>Preview</div>
          <div style={pageStyles.previewContent}>
            <InvoicePreview
              config={config}
              order={sampleOrder as OrderData}
              shop={shop as ShopData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Map Shopify GraphQL order to our OrderData interface
function mapShopifyOrderToOrderData(node: any): OrderData {
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
    invoiceNumber: `INV-${node.name.replace("#", "").padStart(4, "0")}`,
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

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};

const pageStyles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "#f6f6f7",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 16px",
    background: "#fff",
    borderBottom: "1px solid #e5e5e5",
    flexShrink: 0,
  },
  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  backButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    color: "#006fbb",
    padding: "4px 0",
  },
  nameInput: {
    fontSize: "15px",
    fontWeight: 600,
    border: "1px solid transparent",
    padding: "4px 8px",
    borderRadius: "4px",
    background: "transparent",
    minWidth: "200px",
  },
  saveButton: {
    background: "#008060",
    color: "#fff",
    border: "none",
    padding: "8px 20px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  splitContainer: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  editorPanel: {
    width: "50%",
    overflowY: "auto",
    background: "#fff",
    borderRight: "1px solid #e5e5e5",
  },
  previewPanel: {
    width: "50%",
    overflowY: "auto",
    background: "#f0f0f0",
    display: "flex",
    flexDirection: "column",
  },
  previewHeader: {
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    borderBottom: "1px solid #e5e5e5",
    background: "#fff",
    flexShrink: 0,
  },
  previewContent: {
    flex: 1,
    padding: "24px",
    overflowY: "auto",
  },
};
