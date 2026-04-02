import type { TemplateConfig, OrderData, ShopData } from "../types/template";
import { InvoiceClassic } from "./InvoiceClassic";
import { InvoiceModern } from "./InvoiceModern";

interface InvoicePreviewProps {
  config: TemplateConfig;
  order: OrderData;
  shop: ShopData;
}

export function InvoicePreview({ config, order, shop }: InvoicePreviewProps) {
  const layout = config.layout || "classic";

  switch (layout) {
    case "modern":
      return <InvoiceModern config={config} order={order} shop={shop} />;
    case "classic":
    default:
      return <InvoiceClassic config={config} order={order} shop={shop} />;
  }
}
