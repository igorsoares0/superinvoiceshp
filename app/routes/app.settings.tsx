import { useState, useCallback } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  uploadFile,
  deleteFile,
  getLogoKey,
} from "../services/r2.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.upsert({
    where: { shopDomain: session.shop },
    update: {},
    create: { shopDomain: session.shop },
  });

  return { shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const shop = await prisma.shop.findUniqueOrThrow({
    where: { shopDomain: session.shop },
  });

  switch (intent) {
    case "updateEmail": {
      const email = formData.get("email") as string;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { error: "Email inválido" };
      }
      await prisma.shop.update({
        where: { id: shop.id },
        data: { email: email || null },
      });
      return { success: "Email atualizado com sucesso" };
    }

    case "uploadLogo": {
      const file = formData.get("logo") as File;
      if (!file || file.size === 0) {
        return { error: "Nenhum arquivo selecionado" };
      }
      if (file.size > 2 * 1024 * 1024) {
        return { error: "Arquivo deve ter no máximo 2MB" };
      }
      const allowedTypes = [
        "image/png",
        "image/jpeg",
        "image/svg+xml",
      ];
      if (!allowedTypes.includes(file.type)) {
        return { error: "Formato inválido. Use PNG, JPG ou SVG" };
      }

      // Delete old logo if exists
      if (shop.logoUrl) {
        const oldKey = shop.logoUrl.split("/").slice(-3).join("/");
        try {
          await deleteFile(oldKey);
        } catch {
          // ignore if old file doesn't exist
        }
      }

      const ext = file.name.split(".").pop() || "png";
      const key = getLogoKey(shop.id, `logo-${Date.now()}.${ext}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      const logoUrl = await uploadFile(key, buffer, file.type);

      await prisma.shop.update({
        where: { id: shop.id },
        data: { logoUrl },
      });

      return { success: "Logo atualizado com sucesso", logoUrl };
    }

    case "removeLogo": {
      if (shop.logoUrl) {
        const key = shop.logoUrl.split("/").slice(-3).join("/");
        try {
          await deleteFile(key);
        } catch {
          // ignore
        }
        await prisma.shop.update({
          where: { id: shop.id },
          data: { logoUrl: null },
        });
      }
      return { success: "Logo removido com sucesso" };
    }

    default:
      return { error: "Ação desconhecida" };
  }
};

export default function Settings() {
  const { shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const isSubmitting = navigation.state === "submitting";

  const [email, setEmail] = useState(shop.email || "");
  const [logoPreview, setLogoPreview] = useState<string | null>(
    shop.logoUrl,
  );

  const handleEmailSave = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "updateEmail");
    formData.set("email", email);
    submit(formData, { method: "POST" });
    shopify.toast.show("Email salvo");
  }, [email, submit, shopify]);

  const handleLogoUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (file.size > 2 * 1024 * 1024) {
        shopify.toast.show("Arquivo deve ter no máximo 2MB", {
          isError: true,
        });
        return;
      }

      // Preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload
      const formData = new FormData();
      formData.set("intent", "uploadLogo");
      formData.set("logo", file);
      submit(formData, {
        method: "POST",
        encType: "multipart/form-data",
      });
      shopify.toast.show("Logo atualizado");
    },
    [submit, shopify],
  );

  const handleLogoRemove = useCallback(() => {
    setLogoPreview(null);
    const formData = new FormData();
    formData.set("intent", "removeLogo");
    submit(formData, { method: "POST" });
    shopify.toast.show("Logo removido");
  }, [submit, shopify]);

  return (
    <s-page heading="Configurações" narrowWidth>
      <s-layout>
        <s-layout-section>
          <s-card>
            <s-box padding="base">
              <s-stack direction="block" gap="base">
                <s-heading>Logo da Loja</s-heading>
                <s-paragraph>
                  O logo aparecerá nas suas faturas. Aceita PNG, JPG ou SVG
                  (máx. 2MB).
                </s-paragraph>

                {logoPreview && (
                  <s-box
                    padding="base"
                    borderWidth="base"
                    borderRadius="base"
                  >
                    <s-stack direction="block" gap="base" align="center">
                      <img
                        src={logoPreview}
                        alt="Logo da loja"
                        style={{
                          maxWidth: "200px",
                          maxHeight: "100px",
                          objectFit: "contain",
                        }}
                      />
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={handleLogoRemove}
                        {...(isSubmitting ? { disabled: true } : {})}
                      >
                        Remover logo
                      </s-button>
                    </s-stack>
                  </s-box>
                )}

                <s-box>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoUpload}
                    style={{ marginTop: "8px" }}
                  />
                </s-box>
              </s-stack>
            </s-box>
          </s-card>

          <s-card>
            <s-box padding="base">
              <s-stack direction="block" gap="base">
                <s-heading>Email Profissional</s-heading>
                <s-paragraph>
                  Este email será usado como remetente das faturas enviadas e
                  aparecerá no cabeçalho da invoice.
                </s-paragraph>

                <s-text-field
                  label="Email"
                  type="email"
                  value={email}
                  onInput={(e: Event) =>
                    setEmail((e.target as HTMLInputElement).value)
                  }
                  placeholder="contato@minhaloja.com"
                />

                <s-stack direction="inline" gap="base">
                  <s-button
                    variant="primary"
                    onClick={handleEmailSave}
                    {...(isSubmitting ? { loading: true } : {})}
                  >
                    Salvar
                  </s-button>
                </s-stack>
              </s-stack>
            </s-box>
          </s-card>
        </s-layout-section>
      </s-layout>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
