import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  if (!shop || !payload) {
    return new Response("Invalid webhook", { status: 400 });
  }

  const subscription = payload.app_subscription as {
    admin_graphql_api_id: string;
    name: string;
    status: string;
  };

  if (!subscription) {
    return new Response("No subscription data", { status: 400 });
  }

  const shopRecord = await prisma.shop.findUnique({
    where: { shopDomain: shop },
  });

  if (!shopRecord) {
    return new Response("Shop not found", { status: 404 });
  }

  if (
    subscription.status === "ACTIVE" ||
    subscription.status === "ACCEPTED"
  ) {
    // Find matching plan by display name
    const plan = await prisma.plan.findFirst({
      where: { displayName: subscription.name },
    });

    if (plan) {
      await prisma.shop.update({
        where: { id: shopRecord.id },
        data: {
          planId: plan.id,
          invoiceCount: 0,
          cycleStartAt: new Date(),
        },
      });
    }
  } else if (
    subscription.status === "CANCELLED" ||
    subscription.status === "DECLINED" ||
    subscription.status === "EXPIRED"
  ) {
    const freePlan = await prisma.plan.findUnique({
      where: { name: "free" },
    });

    await prisma.shop.update({
      where: { id: shopRecord.id },
      data: {
        planId: freePlan?.id ?? null,
        invoiceCount: 0,
        cycleStartAt: new Date(),
      },
    });
  }

  return new Response("OK", { status: 200 });
};
