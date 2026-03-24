import prisma from "../db.server";
import { DEFAULT_TEMPLATE_CONFIG } from "../types/template";

const CYCLE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null;
  planName: string;
}

export async function checkInvoiceLimit(
  shopId: string,
): Promise<LimitCheckResult> {
  const shop = await prisma.shop.findUniqueOrThrow({
    where: { id: shopId },
    include: { plan: true },
  });

  const plan = shop.plan ?? {
    name: "free",
    displayName: "Free",
    invoiceLimit: 30,
  };

  // Reset cycle if expired
  const cycleAge = Date.now() - shop.cycleStartAt.getTime();
  if (cycleAge >= CYCLE_DURATION_MS) {
    await prisma.shop.update({
      where: { id: shopId },
      data: { invoiceCount: 0, cycleStartAt: new Date() },
    });
    return {
      allowed: true,
      current: 0,
      limit: plan.invoiceLimit,
      planName: plan.displayName ?? plan.name,
    };
  }

  // Unlimited plan
  if (plan.invoiceLimit === null) {
    return {
      allowed: true,
      current: shop.invoiceCount,
      limit: null,
      planName: plan.displayName ?? plan.name,
    };
  }

  return {
    allowed: shop.invoiceCount < plan.invoiceLimit,
    current: shop.invoiceCount,
    limit: plan.invoiceLimit,
    planName: plan.displayName ?? plan.name,
  };
}

export async function incrementInvoiceCount(shopId: string): Promise<void> {
  await prisma.shop.update({
    where: { id: shopId },
    data: { invoiceCount: { increment: 1 } },
  });
}

export async function getOrCreateShop(shopDomain: string) {
  const existing = await prisma.shop.findUnique({
    where: { shopDomain },
    include: { plan: true },
  });

  if (existing) return existing;

  const freePlan = await prisma.plan.findUnique({
    where: { name: "free" },
  });

  const shop = await prisma.shop.create({
    data: {
      shopDomain,
      planId: freePlan?.id ?? null,
    },
    include: { plan: true },
  });

  // Create default template for new shops
  await prisma.invoiceTemplate.create({
    data: {
      shopId: shop.id,
      name: "Template Padrão",
      isDefault: true,
      config: DEFAULT_TEMPLATE_CONFIG as object,
    },
  });

  return shop;
}

export async function updateShopPlan(
  shopDomain: string,
  planName: string,
): Promise<void> {
  const plan = await prisma.plan.findUniqueOrThrow({
    where: { name: planName },
  });

  await prisma.shop.update({
    where: { shopDomain },
    data: {
      planId: plan.id,
      invoiceCount: 0,
      cycleStartAt: new Date(),
    },
  });
}

const SUBSCRIPTION_CREATE_MUTATION = `#graphql
  mutation AppSubscriptionCreate(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      test: $test
    ) {
      appSubscription {
        id
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const ACTIVE_SUBSCRIPTIONS_QUERY = `#graphql
  query ActiveSubscriptions {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        lineItems {
          plan {
            pricingDetails {
              ... on AppRecurringPricing {
                price {
                  amount
                  currencyCode
                }
                interval
              }
            }
          }
        }
      }
    }
  }
`;

const SUBSCRIPTION_CANCEL_MUTATION = `#graphql
  mutation AppSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function createSubscription(
  admin: { graphql: Function },
  planName: string,
  planDisplayName: string,
  price: number,
  returnUrl: string,
  test: boolean = true,
) {
  const response = await admin.graphql(SUBSCRIPTION_CREATE_MUTATION, {
    variables: {
      name: planDisplayName,
      returnUrl,
      test,
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: price, currencyCode: "USD" },
              interval: "EVERY_30_DAYS",
            },
          },
        },
      ],
    },
  });

  const json = await response.json();
  const data = json.data?.appSubscriptionCreate;

  if (data?.userErrors?.length > 0) {
    throw new Error(data.userErrors.map((e: any) => e.message).join(", "));
  }

  return {
    subscriptionId: data?.appSubscription?.id,
    confirmationUrl: data?.confirmationUrl,
  };
}

export async function getActiveSubscription(admin: { graphql: Function }) {
  const response = await admin.graphql(ACTIVE_SUBSCRIPTIONS_QUERY);
  const json = await response.json();
  const subscriptions =
    json.data?.currentAppInstallation?.activeSubscriptions ?? [];

  return subscriptions[0] ?? null;
}

export async function cancelSubscription(
  admin: { graphql: Function },
  subscriptionId: string,
) {
  const response = await admin.graphql(SUBSCRIPTION_CANCEL_MUTATION, {
    variables: { id: subscriptionId },
  });

  const json = await response.json();
  const data = json.data?.appSubscriptionCancel;

  if (data?.userErrors?.length > 0) {
    throw new Error(data.userErrors.map((e: any) => e.message).join(", "));
  }

  return data?.appSubscription;
}
