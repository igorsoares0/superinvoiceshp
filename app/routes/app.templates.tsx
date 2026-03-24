import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useSubmit, useNavigation, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { getOrCreateShop } from "../services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);

  const templates = await prisma.invoiceTemplate.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      isDefault: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { templates, shopId: shop.id };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const templateId = formData.get("templateId") as string;

  const shop = await getOrCreateShop(session.shop);

  switch (intent) {
    case "delete": {
      const count = await prisma.invoiceTemplate.count({
        where: { shopId: shop.id },
      });
      if (count <= 1) {
        return { error: "Não é possível excluir o único template" };
      }

      const template = await prisma.invoiceTemplate.findUniqueOrThrow({
        where: { id: templateId },
      });

      await prisma.invoiceTemplate.delete({
        where: { id: templateId },
      });

      // If deleted template was default, set another as default
      if (template.isDefault) {
        const another = await prisma.invoiceTemplate.findFirst({
          where: { shopId: shop.id },
        });
        if (another) {
          await prisma.invoiceTemplate.update({
            where: { id: another.id },
            data: { isDefault: true },
          });
        }
      }

      return { success: "Template excluído" };
    }

    case "setDefault": {
      // Remove default from all
      await prisma.invoiceTemplate.updateMany({
        where: { shopId: shop.id },
        data: { isDefault: false },
      });
      // Set new default
      await prisma.invoiceTemplate.update({
        where: { id: templateId },
        data: { isDefault: true },
      });
      return { success: "Template definido como padrão" };
    }

    case "duplicate": {
      const source = await prisma.invoiceTemplate.findUniqueOrThrow({
        where: { id: templateId },
      });
      await prisma.invoiceTemplate.create({
        data: {
          shopId: shop.id,
          name: `Cópia de ${source.name}`,
          isDefault: false,
          config: source.config as object,
        },
      });
      return { success: "Template duplicado" };
    }

    default:
      return { error: "Ação desconhecida" };
  }
};

export default function Templates() {
  const { templates } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const isSubmitting = navigation.state === "submitting";

  const handleAction = (intent: string, templateId: string, toastMsg: string) => {
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("templateId", templateId);
    submit(formData, { method: "POST" });
    shopify.toast.show(toastMsg);
  };

  return (
    <s-page heading="Templates de Fatura">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => navigate("/app/template/new")}
      >
        Novo Template
      </s-button>

      <s-layout>
        <s-layout-section>
          {templates.length === 0 ? (
            <s-card>
              <s-box padding="loose">
                <s-stack direction="block" gap="base" align="center">
                  <s-heading>Nenhum template ainda</s-heading>
                  <s-paragraph>
                    Crie seu primeiro template de fatura para começar.
                  </s-paragraph>
                  <s-button
                    variant="primary"
                    onClick={() => navigate("/app/template/new")}
                  >
                    Criar Template
                  </s-button>
                </s-stack>
              </s-box>
            </s-card>
          ) : (
            <s-stack direction="block" gap="base">
              {templates.map((template) => (
                <s-card key={template.id}>
                  <s-box padding="base">
                    <s-stack direction="inline" gap="base" align="space-between">
                      <s-stack direction="block" gap="tight">
                        <s-stack direction="inline" gap="tight" align="center">
                          <s-heading>{template.name}</s-heading>
                          {template.isDefault && (
                            <s-badge tone="success">Padrão</s-badge>
                          )}
                        </s-stack>
                        <s-text variant="bodySm" tone="neutral">
                          Atualizado em{" "}
                          {new Date(template.updatedAt).toLocaleDateString(
                            "pt-BR",
                          )}
                        </s-text>
                      </s-stack>

                      <s-stack direction="inline" gap="tight">
                        <s-button
                          variant="tertiary"
                          onClick={() =>
                            navigate(`/app/template/${template.id}`)
                          }
                        >
                          Editar
                        </s-button>
                        {!template.isDefault && (
                          <s-button
                            variant="tertiary"
                            onClick={() =>
                              handleAction(
                                "setDefault",
                                template.id,
                                "Definido como padrão",
                              )
                            }
                            {...(isSubmitting ? { disabled: true } : {})}
                          >
                            Definir como padrão
                          </s-button>
                        )}
                        <s-button
                          variant="tertiary"
                          onClick={() =>
                            handleAction(
                              "duplicate",
                              template.id,
                              "Template duplicado",
                            )
                          }
                          {...(isSubmitting ? { disabled: true } : {})}
                        >
                          Duplicar
                        </s-button>
                        {templates.length > 1 && (
                          <s-button
                            variant="tertiary"
                            tone="critical"
                            onClick={() =>
                              handleAction(
                                "delete",
                                template.id,
                                "Template excluído",
                              )
                            }
                            {...(isSubmitting ? { disabled: true } : {})}
                          >
                            Excluir
                          </s-button>
                        )}
                      </s-stack>
                    </s-stack>
                  </s-box>
                </s-card>
              ))}
            </s-stack>
          )}
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
