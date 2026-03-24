import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import puppeteer from "puppeteer";
import { InvoicePreview } from "../components/InvoicePreview";
import type { TemplateConfig, OrderData, ShopData } from "../types/template";

export async function generateInvoicePdf(
  config: TemplateConfig,
  order: OrderData,
  shop: ShopData,
): Promise<Buffer> {
  const html = renderToStaticMarkup(
    createElement(InvoicePreview, { config, order, shop }),
  );

  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
          @page { margin: 20mm 15mm; }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
