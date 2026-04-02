export type LayoutType = "classic" | "modern";

export interface TemplateConfig {
  layout: LayoutType;
  orderInfo: {
    showOrderNumber: boolean;
    showInvoiceNumber: boolean;
    showPurchaseOrderNumber: boolean;
    showOrderDate: boolean;
    showClosingDate: boolean;
    showOrderValue: boolean;
    showOrderTags: boolean;
  };
  paymentInfo: {
    showBillingAddress: boolean;
    showPaymentMethod: boolean;
    showCreditCard: boolean;
  };
  shippingInfo: {
    showShippingAddress: boolean;
    showCustomerEmail: boolean;
    showCustomerPhone: boolean;
  };
  itemDetails: {
    product: {
      showImage: boolean;
      showSku: boolean;
      showWeight: boolean;
      showVariant: boolean;
      showProductType: boolean;
    };
    pricing: {
      showDiscount: boolean;
      showDiscountReason: boolean;
      showCompareAtPrice: boolean;
      showPriceExcludingTax: boolean;
      showPriceAfterDiscount: boolean;
    };
    quantity: {
      showTotalQuantity: boolean;
      showItemTotalTax: boolean;
    };
  };
  orderTotals: {
    summary: {
      showSubtotal: boolean;
      showDiscount: boolean;
      showDiscountReason: boolean;
    };
    shipping: {
      showShipping: boolean;
      showShippingRateName: boolean;
    };
    tax: {
      showExcludingTax: boolean;
      showDuties: boolean;
      showInfo: boolean;
      showPremium: boolean;
      showTaxLabel: boolean;
      groupTaxLines: boolean;
    };
    payment: {
      showPaidByCustomer: boolean;
      showRefundAmount: boolean;
      showNetPayment: boolean;
      showBalance: boolean;
    };
  };
  additional: {
    barcode: {
      showBarcode: boolean;
      barcodeType: "qrcode" | "code128" | "code39";
    };
    notes: {
      showOrderNotes: boolean;
      showFooterNotes: boolean;
      footerNotesText: string;
      showSignature: boolean;
    };
  };
  socialMedia: {
    facebook: string;
    instagram: string;
    twitter: string;
    linkedin: string;
    website: string;
  };
}

export const DEFAULT_TEMPLATE_CONFIG: TemplateConfig = {
  layout: "classic",
  orderInfo: {
    showOrderNumber: true,
    showInvoiceNumber: true,
    showPurchaseOrderNumber: false,
    showOrderDate: true,
    showClosingDate: false,
    showOrderValue: true,
    showOrderTags: false,
  },
  paymentInfo: {
    showBillingAddress: true,
    showPaymentMethod: true,
    showCreditCard: false,
  },
  shippingInfo: {
    showShippingAddress: true,
    showCustomerEmail: true,
    showCustomerPhone: false,
  },
  itemDetails: {
    product: {
      showImage: true,
      showSku: true,
      showWeight: false,
      showVariant: true,
      showProductType: false,
    },
    pricing: {
      showDiscount: false,
      showDiscountReason: false,
      showCompareAtPrice: false,
      showPriceExcludingTax: true,
      showPriceAfterDiscount: false,
    },
    quantity: {
      showTotalQuantity: true,
      showItemTotalTax: true,
    },
  },
  orderTotals: {
    summary: {
      showSubtotal: true,
      showDiscount: false,
      showDiscountReason: false,
    },
    shipping: {
      showShipping: true,
      showShippingRateName: false,
    },
    tax: {
      showExcludingTax: true,
      showDuties: false,
      showInfo: false,
      showPremium: false,
      showTaxLabel: false,
      groupTaxLines: false,
    },
    payment: {
      showPaidByCustomer: true,
      showRefundAmount: false,
      showNetPayment: false,
      showBalance: false,
    },
  },
  additional: {
    barcode: {
      showBarcode: false,
      barcodeType: "qrcode",
    },
    notes: {
      showOrderNotes: false,
      showFooterNotes: false,
      footerNotesText: "",
      showSignature: false,
    },
  },
  socialMedia: {
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: "",
    website: "",
  },
};

// Sample order data for preview when no real orders exist
export interface OrderData {
  id: string;
  name: string;
  orderNumber: string;
  invoiceNumber: string;
  poNumber: string | null;
  createdAt: string;
  closedAt: string | null;
  tags: string[];
  financialStatus: string;
  customer: {
    name: string;
    email: string;
    phone: string | null;
  } | null;
  billingAddress: {
    formatted: string[];
  } | null;
  shippingAddress: {
    formatted: string[];
  } | null;
  paymentMethod: string | null;
  creditCard: {
    company: string;
    lastFour: string;
  } | null;
  shippingLine: {
    title: string;
    price: string;
  } | null;
  lineItems: Array<{
    name: string;
    quantity: number;
    sku: string | null;
    weight: string | null;
    variant: string | null;
    productType: string | null;
    imageUrl: string | null;
    price: string;
    compareAtPrice: string | null;
    discount: string;
    discountReason: string | null;
    priceAfterDiscount: string;
    taxTotal: string;
    total: string;
  }>;
  subtotal: string;
  totalDiscount: string;
  discountReason: string | null;
  shippingTotal: string;
  shippingRateName: string | null;
  taxTotal: string;
  taxLines: Array<{ title: string; rate: string; amount: string }>;
  duties: string;
  total: string;
  paidByCustomer: string;
  refundAmount: string;
  netPayment: string;
  balance: string;
  note: string | null;
  currency: string;
}

export interface ShopData {
  name: string;
  email: string | null;
  logoUrl: string | null;
}

export const SAMPLE_ORDER: OrderData = {
  id: "gid://shopify/Order/sample",
  name: "#1001",
  orderNumber: "1001",
  invoiceNumber: "INV-0001",
  poNumber: "PO-2026-001",
  createdAt: "2026-01-15T10:30:00Z",
  closedAt: "2026-01-15T14:00:00Z",
  tags: ["vip", "wholesale"],
  financialStatus: "PAID",
  customer: {
    name: "Maria Silva",
    email: "maria@exemplo.com",
    phone: "+55 11 99999-0000",
  },
  billingAddress: {
    formatted: [
      "Maria Silva",
      "Rua Augusta, 1200",
      "São Paulo, SP 01304-001",
      "Brasil",
    ],
  },
  shippingAddress: {
    formatted: [
      "Maria Silva",
      "Av. Paulista, 1000, Apto 501",
      "São Paulo, SP 01310-100",
      "Brasil",
    ],
  },
  paymentMethod: "Cartão de Crédito",
  creditCard: {
    company: "Visa",
    lastFour: "4242",
  },
  shippingLine: {
    title: "Envio Padrão",
    price: "15.00",
  },
  lineItems: [
    {
      name: "Camiseta Premium Algodão",
      quantity: 2,
      sku: "CAM-PRE-001",
      weight: "0.3 kg",
      variant: "Azul / M",
      productType: "Vestuário",
      imageUrl: null,
      price: "89.90",
      compareAtPrice: "119.90",
      discount: "10.00",
      discountReason: "Promoção de Verão",
      priceAfterDiscount: "79.90",
      taxTotal: "14.38",
      total: "159.80",
    },
    {
      name: "Boné Esportivo",
      quantity: 1,
      sku: "BON-ESP-003",
      weight: "0.15 kg",
      variant: "Preto",
      productType: "Acessórios",
      imageUrl: null,
      price: "49.90",
      compareAtPrice: null,
      discount: "0.00",
      discountReason: null,
      priceAfterDiscount: "49.90",
      taxTotal: "4.49",
      total: "49.90",
    },
  ],
  subtotal: "209.70",
  totalDiscount: "20.00",
  discountReason: "Promoção de Verão",
  shippingTotal: "15.00",
  shippingRateName: "Envio Padrão",
  taxTotal: "18.87",
  taxLines: [
    { title: "ICMS", rate: "18%", amount: "16.47" },
    { title: "PIS/COFINS", rate: "1.65%", amount: "2.40" },
  ],
  duties: "0.00",
  total: "223.57",
  paidByCustomer: "223.57",
  refundAmount: "0.00",
  netPayment: "223.57",
  balance: "0.00",
  note: "Entregar no período da tarde, por favor.",
  currency: "BRL",
};
