import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useSubmit, useNavigation, redirect } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  getOrCreateShop,
  createSubscription,
  getActiveSubscription,
  cancelSubscription,
  updateShopPlan,
} from "../services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await getOrCreateShop(session.shop);
  const plans = await prisma.plan.findMany({
    orderBy: { price: "asc" },
  });

  // Check if returning from Shopify confirmation
  const url = new URL(request.url);
  const charge_id = url.searchParams.get("charge_id");
  if (charge_id) {
    // Subscription was confirmed — find which plan by checking active subscription
    const { admin } = await authenticate.admin(request);
    const activeSub = await getActiveSubscription(admin);
    if (activeSub) {
      const matchedPlan = plans.find(
        (p) => p.displayName === activeSub.name,
      );
      if (matchedPlan) {
        await updateShopPlan(session.shop, matchedPlan.name);
      }
    }
    return redirect("/app/pricing");
  }

  return {
    shop: {
      id: shop.id,
      invoiceCount: shop.invoiceCount,
      cycleStartAt: shop.cycleStartAt,
    },
    currentPlan: shop.plan,
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      displayName: p.displayName,
      price: Number(p.price),
      invoiceLimit: p.invoiceLimit,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  switch (intent) {
    case "subscribe": {
      const planName = formData.get("planName") as string;
      const plan = await prisma.plan.findUniqueOrThrow({
        where: { name: planName },
      });

      if (Number(plan.price) === 0) {
        // Downgrade to free — cancel existing subscription
        const activeSub = await getActiveSubscription(admin);
        if (activeSub) {
          await cancelSubscription(admin, activeSub.id);
        }
        await updateShopPlan(session.shop, "free");
        return { success: "Plano atualizado para Free" };
      }

      const appUrl = process.env.SHOPIFY_APP_URL || "";
      const returnUrl = `${appUrl}/app/pricing`;

      const { confirmationUrl } = await createSubscription(
        admin,
        plan.name,
        plan.displayName,
        Number(plan.price),
        returnUrl,
      );

      if (confirmationUrl) {
        throw redirect(confirmationUrl);
      }

      return { error: "Erro ao criar assinatura" };
    }

    case "cancel": {
      const activeSub = await getActiveSubscription(admin);
      if (activeSub) {
        await cancelSubscription(admin, activeSub.id);
      }
      await updateShopPlan(session.shop, "free");
      return { success: "Assinatura cancelada. Plano Free ativado." };
    }

    default:
      return { error: "Ação desconhecida" };
  }
};

export default function Pricing() {
  const { shop, currentPlan, plans } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const isSubmitting = navigation.state === "submitting";

  const usagePercent =
    currentPlan?.invoiceLimit != null
      ? Math.min(
          Math.round((shop.invoiceCount / currentPlan.invoiceLimit) * 100),
          100,
        )
      : 0;
  const isNearLimit = currentPlan?.invoiceLimit != null && usagePercent >= 80;

  const handleSubscribe = (planName: string) => {
    const formData = new FormData();
    formData.set("intent", "subscribe");
    formData.set("planName", planName);
    submit(formData, { method: "POST" });
  };

  const handleCancel = () => {
    const formData = new FormData();
    formData.set("intent", "cancel");
    submit(formData, { method: "POST" });
    shopify.toast.show("Assinatura cancelada");
  };

  return (
    <s-page heading="Planos">
      {isNearLimit && (
        <s-banner tone="warning">
          Você já usou {usagePercent}% do seu limite de invoices neste ciclo.
          Considere fazer upgrade do seu plano.
        </s-banner>
      )}

      <s-layout>
        <s-layout-section>
          <s-stack direction="block" gap="base">
            {/* Usage bar */}
            <s-card>
              <s-box padding="base">
                <s-stack direction="block" gap="base">
                  <s-heading>Uso atual</s-heading>
                  <s-paragraph>
                    {currentPlan?.invoiceLimit != null ? (
                      <>
                        {shop.invoiceCount} / {currentPlan.invoiceLimit} invoices
                        neste ciclo
                      </>
                    ) : (
                      <>{shop.invoiceCount} invoices neste ciclo (ilimitado)</>
                    )}
                  </s-paragraph>
                  {currentPlan?.invoiceLimit != null && (
                    <s-progress-bar
                      progress={usagePercent}
                      size="small"
                      {...(isNearLimit ? { tone: "critical" } : {})}
                    />
                  )}
                </s-stack>
              </s-box>
            </s-card>

            {/* Plan cards */}
            <s-stack direction="inline" gap="base" wrap>
              {plans.map((plan) => {
                const isCurrent = currentPlan?.name === plan.name;
                return (
                  <s-card key={plan.id}>
                    <s-box
                      padding="base"
                      minInlineSize="220px"
                    >
                      <s-stack direction="block" gap="base" align="center">
                        <s-heading>{plan.displayName}</s-heading>

                        <s-text
                          variant="headingLg"
                          fontWeight="bold"
                        >
                          {plan.price === 0
                            ? "Grátis"
                            : `$${plan.price}/mês`}
                        </s-text>

                        <s-paragraph>
                          {plan.invoiceLimit != null
                            ? `${plan.invoiceLimit} invoices`
                            : "Invoices ilimitadas"}
                        </s-paragraph>

                        {isCurrent ? (
                          <s-stack direction="block" gap="tight">
                            <s-badge tone="success">Plano Atual</s-badge>
                            {plan.name !== "free" && (
                              <s-button
                                variant="tertiary"
                                tone="critical"
                                onClick={handleCancel}
                                {...(isSubmitting ? { disabled: true } : {})}
                              >
                                Cancelar
                              </s-button>
                            )}
                          </s-stack>
                        ) : (
                          <s-button
                            variant={
                              plan.price > Number(currentPlan?.price ?? 0)
                                ? "primary"
                                : "tertiary"
                            }
                            onClick={() => handleSubscribe(plan.name)}
                            {...(isSubmitting ? { loading: true } : {})}
                          >
                            {plan.price > Number(currentPlan?.price ?? 0)
                              ? "Upgrade"
                              : "Downgrade"}
                          </s-button>
                        )}
                      </s-stack>
                    </s-box>
                  </s-card>
                );
              })}
            </s-stack>
          </s-stack>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
