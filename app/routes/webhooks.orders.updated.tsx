import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { updateInvoiceFromOrder } from "../services/invoice.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  if (!shop || !payload) {
    return new Response("Invalid webhook", { status: 400 });
  }

  const shopRecord = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!shopRecord) {
    return new Response("OK", { status: 200 });
  }

  const orderId = `gid://shopify/Order/${payload.id}`;

  await updateInvoiceFromOrder(shopRecord.id, orderId, {
    customerName:
      payload.customer
        ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() || null
        : null,
    customerEmail: payload.customer?.email || null,
    subtotal: payload.subtotal_price || undefined,
    discount: payload.total_discounts || undefined,
    total: payload.total_price || undefined,
  });

  return new Response("OK", { status: 200 });
};
