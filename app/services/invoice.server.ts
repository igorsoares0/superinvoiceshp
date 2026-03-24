import prisma from "../db.server";

export async function getOrCreateInvoice(
  shopId: string,
  shopifyOrderId: string,
  orderData: {
    orderNumber: string;
    customerName: string | null;
    customerEmail: string | null;
    subtotal: string;
    discount: string;
    total: string;
    currency: string;
  },
) {
  const existing = await prisma.invoice.findUnique({
    where: {
      shopId_shopifyOrderId: { shopId, shopifyOrderId },
    },
  });

  if (existing) return existing;

  const invoiceNumber = await generateInvoiceNumber(shopId);

  // Get default template
  const defaultTemplate = await prisma.invoiceTemplate.findFirst({
    where: { shopId, isDefault: true },
  });

  return prisma.invoice.create({
    data: {
      shopId,
      shopifyOrderId,
      orderNumber: orderData.orderNumber,
      invoiceNumber,
      customerName: orderData.customerName,
      customerEmail: orderData.customerEmail,
      subtotal: orderData.subtotal,
      discount: orderData.discount,
      total: orderData.total,
      currency: orderData.currency,
      templateId: defaultTemplate?.id ?? null,
    },
  });
}

async function generateInvoiceNumber(shopId: string): Promise<string> {
  const lastInvoice = await prisma.invoice.findFirst({
    where: { shopId },
    orderBy: { createdAt: "desc" },
    select: { invoiceNumber: true },
  });

  let nextNum = 1;
  if (lastInvoice) {
    const match = lastInvoice.invoiceNumber.match(/(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  return `INV-${String(nextNum).padStart(4, "0")}`;
}

export async function updateInvoiceStatus(
  invoiceId: string,
  status: string,
  extra?: { pdfUrl?: string; sentAt?: Date },
) {
  return prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status,
      ...extra,
    },
  });
}

export async function getInvoiceByOrderId(
  shopId: string,
  shopifyOrderId: string,
) {
  return prisma.invoice.findUnique({
    where: {
      shopId_shopifyOrderId: { shopId, shopifyOrderId },
    },
  });
}

export async function updateInvoiceFromOrder(
  shopId: string,
  shopifyOrderId: string,
  data: {
    customerName?: string | null;
    customerEmail?: string | null;
    subtotal?: string;
    discount?: string;
    total?: string;
  },
) {
  const invoice = await getInvoiceByOrderId(shopId, shopifyOrderId);
  if (!invoice) return null;

  return prisma.invoice.update({
    where: { id: invoice.id },
    data,
  });
}
