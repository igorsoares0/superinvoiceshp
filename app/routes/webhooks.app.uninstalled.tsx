import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  // Clean up shop data (GDPR compliance)
  if (shop) {
    const shopRecord = await db.shop.findUnique({
      where: { shopDomain: shop },
    });
    if (shopRecord) {
      await db.invoice.deleteMany({ where: { shopId: shopRecord.id } });
      await db.invoiceTemplate.deleteMany({ where: { shopId: shopRecord.id } });
      await db.shop.delete({ where: { id: shopRecord.id } });
    }
  }

  return new Response();
};
