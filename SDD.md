# SuperInvoices — Spec-Driven Development (SDD)

> App Shopify público para gerência, customização e envio de invoices (faturas).

---

## Sumário

- [1. Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
- [2. Data Models (Prisma)](#2-data-models-prisma)
- [3. Shopify Scopes & Webhooks](#3-shopify-scopes--webhooks)
- [4. Integrações Externas](#4-integrações-externas)
- [5. Especificação de Rotas / Páginas](#5-especificação-de-rotas--páginas)
- [6. API Interna (Actions / Loaders)](#6-api-interna-actions--loaders)
- [7. Geração de PDF](#7-geração-de-pdf)
- [8. Billing (Planos)](#8-billing-planos)
- [9. Fases de Desenvolvimento](#9-fases-de-desenvolvimento)
- [10. Critérios de Aceite Globais](#10-critérios-de-aceite-globais)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Shopify Admin (Embedded)              │
│  ┌───────────────────────────────────────────────────┐  │
│  │          SuperInvoices App (React Router 7)       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │  Polaris  │ │ Template │ │  PDF Generator   │  │  │
│  │  │    UI     │ │  Editor  │ │  (server-side)   │  │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                               │
│  ┌───────────────────────┼───────────────────────────┐  │
│  │               Server (Node.js)                    │  │
│  │  ┌──────────┐ ┌──────┐ ┌────────┐ ┌───────────┐  │  │
│  │  │ Shopify  │ │Prisma│ │Postmark│ │Cloudflare │  │  │
│  │  │Admin API │ │ ORM  │ │ Email  │ │    R2     │  │  │
│  │  └──────────┘ └──────┘ └────────┘ └───────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
│                          │                               │
│              ┌───────────┴───────────┐                   │
│              │     PostgreSQL        │                   │
│              └───────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### Stack

| Camada       | Tecnologia                                      |
| ------------ | ----------------------------------------------- |
| Framework    | React Router 7 + Vite 6                         |
| UI           | Shopify Polaris (Web Components)                |
| Linguagem    | TypeScript 5.9                                  |
| ORM          | Prisma 6                                        |
| Banco        | PostgreSQL (SQLite somente em dev local)        |
| Email        | Postmark                                        |
| Storage      | Cloudflare R2 (logos, assets)                   |
| PDF          | Puppeteer (ou react-pdf/renderer)               |
| Auth         | Shopify OAuth2 (via shopify-app-react-router)   |
| Billing      | Shopify Billing API (GraphQL)                   |
| API Shopify  | Admin GraphQL API 2026-04                       |

---

## 2. Data Models (Prisma)

### 2.1 Session (já existe)

Sem alterações — mantém o modelo atual para session storage do Shopify.

### 2.2 Shop

```prisma
model Shop {
  id            String   @id @default(cuid())
  shopDomain    String   @unique           // "myshop.myshopify.com"
  name          String?
  email         String?                     // email profissional da loja
  logoUrl       String?                     // URL no R2
  planId        String?
  plan          Plan?    @relation(fields: [planId], references: [id])
  invoiceCount  Int      @default(0)       // invoices geradas no ciclo atual
  cycleStartAt  DateTime @default(now())   // início do ciclo de billing
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  templates     InvoiceTemplate[]
  invoices      Invoice[]
}
```

### 2.3 Plan

```prisma
model Plan {
  id              String   @id @default(cuid())
  name            String   @unique          // "free", "basic", "pro", "scale"
  displayName     String                     // "Free", "Basic", "Pro", "Scale"
  price           Decimal  @default(0)       // em USD
  invoiceLimit    Int?                       // null = ilimitado
  features        Json     @default("[]")
  shopifyPlanId   String?                    // ID do plano no Shopify Billing
  createdAt       DateTime @default(now())

  shops           Shop[]
}
```

**Seed data:**

| name  | displayName | price | invoiceLimit |
| ----- | ----------- | ----- | ------------ |
| free  | Free        | 0     | 30           |
| basic | Basic       | 9     | 300          |
| pro   | Pro         | 19    | 1000         |
| scale | Scale       | 39    | null         |

### 2.4 InvoiceTemplate

```prisma
model InvoiceTemplate {
  id          String   @id @default(cuid())
  shopId      String
  shop        Shop     @relation(fields: [shopId], references: [id], onDelete: Cascade)
  name        String                        // "Template Padrão"
  isDefault   Boolean  @default(false)
  config      Json                          // JSON com toda a configuração do template
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  invoices    Invoice[]

  @@index([shopId])
}
```

### 2.5 Invoice

```prisma
model Invoice {
  id              String   @id @default(cuid())
  shopId          String
  shop            Shop     @relation(fields: [shopId], references: [id], onDelete: Cascade)
  templateId      String?
  template        InvoiceTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)
  shopifyOrderId  String                    // GID do pedido no Shopify
  orderNumber     String                    // "#1001"
  invoiceNumber   String                    // "INV-0001" (sequencial por shop)
  customerName    String?
  customerEmail   String?
  subtotal        Decimal
  discount        Decimal  @default(0)
  total           Decimal
  currency        String   @default("USD")
  status          String   @default("draft") // "draft", "sent", "viewed"
  pdfUrl          String?                    // URL no R2 após geração
  sentAt          DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([shopId, shopifyOrderId])
  @@unique([shopId, invoiceNumber])
  @@index([shopId])
}
```

### 2.6 Diagrama ER

```
Session (existente, sem FK)

Shop 1──* InvoiceTemplate
Shop 1──* Invoice
Shop *──1 Plan
InvoiceTemplate 1──* Invoice
```

---

## 3. Shopify Scopes & Webhooks

### Scopes necessários

| Scope                   | Motivo                                           |
| ----------------------- | ------------------------------------------------ |
| `read_orders`           | Listar pedidos na home, dados para invoice        |
| `read_customers`        | Nome/email do cliente para a invoice              |
| `read_products`         | Imagens e detalhes dos produtos nos line items    |
| `read_shipping`         | Informações de envio para a invoice               |

> Remover scopes atuais (`write_metaobject_definitions`, `write_metaobjects`, `write_products`) — são do template demo e não são necessários.

### Webhooks

| Tópico                  | Rota                              | Ação                                    |
| ----------------------- | --------------------------------- | ---------------------------------------- |
| `app/uninstalled`       | `/webhooks/app/uninstalled`       | Deletar sessions + dados da shop         |
| `app/scopes_update`     | `/webhooks/app/scopes_update`     | Atualizar scopes na session              |
| `orders/updated`        | `/webhooks/orders/updated`        | Atualizar status/dados da invoice (se existir) |
| `app_subscriptions/update` | `/webhooks/app-subscriptions/update` | Atualizar plano da shop             |

---

## 4. Integrações Externas

### 4.1 Postmark (Email)

```
POST https://api.postmarkapp.com/email
Authorization: Server-Token {POSTMARK_SERVER_TOKEN}
```

**Variáveis de ambiente:**
- `POSTMARK_SERVER_TOKEN`
- `POSTMARK_FROM_EMAIL` (fallback se shop não tiver email configurado)

**Fluxo de envio:**
1. Gerar PDF da invoice (server-side)
2. Upload do PDF para R2
3. Enviar email via Postmark com PDF em anexo (base64)
4. Atualizar `invoice.status = "sent"` e `invoice.sentAt`

**Template do email:**
- Subject: `"Invoice {invoiceNumber} from {shopName}"`
- Body: HTML simples com link para download do PDF
- Attachment: PDF em base64

### 4.2 Cloudflare R2 (Storage)

```
Endpoint: https://{ACCOUNT_ID}.r2.cloudflarestorage.com
Bucket: superinvoices
```

**Variáveis de ambiente:**
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL` (domínio público do bucket)

**Uso do SDK:** AWS S3 SDK (`@aws-sdk/client-s3`) — R2 é compatível com S3.

**Estrutura de keys:**
```
logos/{shopId}/{filename}
invoices/{shopId}/{invoiceId}.pdf
```

### 4.3 Shopify Billing API

Utilizar a `billing` config nativa do `@shopify/shopify-app-react-router`.

---

## 5. Especificação de Rotas / Páginas

### 5.1 `app._index.tsx` — Home (Lista de Pedidos)

**Loader:**
- Autenticar admin
- Verificar/criar registro `Shop` no banco local
- Buscar pedidos via Shopify Admin API (`orders` query) com paginação (cursor-based)
- Para cada pedido, verificar se já existe `Invoice` local
- Retornar: `{ orders, pagination, shop }`

**UI:**

```
┌─────────────────────────────────────────────────────────┐
│  Pedidos                                    [Filtros ▾] │
├────────┬──────────┬──────────┬──────────┬───────┬──────┤
│ Pedido │ Cliente  │ Subtotal │ Desconto │ Total │Status│ Ações
├────────┼──────────┼──────────┼──────────┼───────┼──────┤
│ #1001  │ João S.  │ $100.00  │ $10.00   │$90.00 │ Pago │ [PDF] [Email]
│ #1002  │ Maria L. │ $250.00  │ $0.00    │$250.00│ Pago │ [PDF] [Email]
│ ...    │          │          │          │       │      │
├────────┴──────────┴──────────┴──────────┴───────┴──────┤
│                    ← 1 2 3 ... →                       │
└────────────────────────────────────────────────────────┘
```

**Componentes Polaris:** `Page`, `IndexTable`, `Badge`, `Button`, `Pagination`

**Actions:**
- `action("download")` → Gera PDF, salva no R2, retorna URL para download
- `action("send")` → Gera PDF (se não existe), envia email via Postmark

**Critérios de aceite:**
- [ ] Lista pedidos com todos os campos especificados
- [ ] Paginação cursor-based funcional (25 por página)
- [ ] Botão PDF gera e baixa o arquivo
- [ ] Botão Email envia a invoice e mostra toast de confirmação
- [ ] Respeita limite de invoices do plano (mostra banner quando atingir limite)
- [ ] Status do pedido exibido com Badge colorido

---

### 5.2 `app.settings.tsx` — Configurações

**Loader:**
- Autenticar admin
- Carregar dados da `Shop` (email, logoUrl)
- Retornar: `{ shop }`

**UI:**

```
┌─────────────────────────────────────────────┐
│  Configurações                              │
│                                             │
│  Logo da Loja                               │
│  ┌─────────────────┐                        │
│  │  [Drop Zone]    │  ← upload de imagem    │
│  │  ou [Escolher]  │                        │
│  └─────────────────┘                        │
│                                             │
│  Email Profissional                         │
│  ┌─────────────────────────────────────┐    │
│  │ contato@minhaloja.com               │    │
│  └─────────────────────────────────────┘    │
│                                             │
│                              [Salvar]       │
└─────────────────────────────────────────────┘
```

**Componentes Polaris:** `Page`, `Layout`, `Card`, `DropZone`, `TextField`, `Button`

**Actions:**
- `action("updateSettings")` → Atualizar email no banco
- `action("uploadLogo")` → Upload da imagem para R2, salvar URL no banco
- `action("removeLogo")` → Deletar do R2, limpar URL no banco

**Critérios de aceite:**
- [ ] Upload de logo funciona com drag-and-drop e seleção de arquivo
- [ ] Aceita apenas imagens (PNG, JPG, SVG) até 2MB
- [ ] Preview da logo após upload
- [ ] Email validado (formato válido)
- [ ] Toast de sucesso/erro após salvar
- [ ] Logo aparece no preview da invoice

---

### 5.3 `app.templates.tsx` — Lista de Templates

**Loader:**
- Autenticar admin
- Buscar `InvoiceTemplate` da shop
- Retornar: `{ templates }`

**UI:**

```
┌─────────────────────────────────────────────────────────┐
│  Templates de Fatura                    [+ Novo Template]│
│                                                          │
│  ┌──────────────────┐  ┌──────────────────┐             │
│  │ ████████████████ │  │ ████████████████ │             │
│  │ █  Miniatura   █ │  │ █  Miniatura   █ │             │
│  │ ████████████████ │  │ ████████████████ │             │
│  │                  │  │                  │             │
│  │ Template Padrão  │  │ Template Minimal │             │
│  │ ✓ Padrão         │  │                  │             │
│  │ [Editar][Excluir]│  │ [Editar][Excluir]│             │
│  └──────────────────┘  └──────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

**Componentes Polaris:** `Page`, `Layout`, `Card`, `ResourceList`, `Button`, `Badge`

**Actions:**
- `action("delete")` → Deletar template (se não for o default)
- `action("setDefault")` → Marcar template como padrão
- `action("duplicate")` → Duplicar template com nome "Cópia de {name}"

**Critérios de aceite:**
- [ ] Lista todos os templates da shop
- [ ] Indicador visual do template padrão
- [ ] Botão "Novo Template" redireciona ao editor
- [ ] Não permite deletar o único template restante
- [ ] Duplicação cria cópia exata com nome diferente

---

### 5.4 `app.templates.$id.tsx` — Editor de Template

**Loader:**
- Autenticar admin
- Carregar `InvoiceTemplate` pelo ID (ou criar novo se `id === "new"`)
- Buscar um pedido sample da loja para preview
- Retornar: `{ template, sampleOrder, shop }`

**UI:**

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Templates    Template Padrão                         [Salvar] │
├────────────────────────────────┬─────────────────────────────────┤
│         EDITOR (50%)           │         PREVIEW (50%)           │
│                                │                                 │
│ ▼ Informações do Pedido        │  ┌─────────────────────────┐   │
│   ☑ Número do pedido           │  │      LOGO DA LOJA       │   │
│   ☑ Número da fatura           │  │                         │   │
│   ☐ Purchase order number      │  │  Fatura #INV-0001       │   │
│   ☑ Data do pedido             │  │  Pedido #1001           │   │
│   ☐ Data de fechamento         │  │  Data: 01/01/2026       │   │
│   ☑ Valor do pedido            │  │                         │   │
│   ☐ Etiquetas do pedido        │  │  Cobrar:    Enviar:     │   │
│                                │  │  Rua A, 10  Rua B, 20   │   │
│ ▼ Informações de Pagamento     │  │                         │   │
│   ☑ Endereço de pagamento      │  │  ┌───┬──────┬────┬────┐ │   │
│   ☑ Método de pagamento        │  │  │Qtd│Item  │Preço│Tot │ │   │
│   ☐ Cartão de crédito          │  │  ├───┼──────┼────┼────┤ │   │
│                                │  │  │ 2 │Camisa│ $50│$100│ │   │
│ ▼ Informações de Envio         │  │  └───┴──────┴────┴────┘ │   │
│   ☑ Endereço de envio          │  │                         │   │
│   ☑ Email do cliente           │  │  Subtotal:    $100.00   │   │
│   ☐ Telefone do cliente        │  │  Desconto:    -$10.00   │   │
│                                │  │  Envio:         $5.00   │   │
│ ▼ Informações dos Itens        │  │  Imposto:       $9.00   │   │
│   ▼ Detalhes do produto        │  │  ─────────────────────  │   │
│     ☑ Imagem do produto        │  │  TOTAL:        $104.00  │   │
│     ☑ SKU do produto           │  │                         │   │
│     ☐ Peso do produto          │  │  [QR CODE]              │   │
│     ☑ Variante do produto      │  │                         │   │
│     ☐ Tipo do produto          │  │  Notas: Obrigado!       │   │
│   ▼ Pricing and discounts      │  │                         │   │
│     ☐ Mostrar desconto         │  │  fb tw ig               │   │
│     ☐ Mostrar motivo desconto  │  └─────────────────────────┘   │
│     ☐ Preço de comparação      │                                 │
│     ☑ Preço sem impostos       │                                 │
│     ☐ Preço após desconto      │                                 │
│   ▼ Quantity and tax           │                                 │
│     ☑ Quantidade total         │                                 │
│     ☑ Imposto total do item    │                                 │
│                                │                                 │
│ ▼ Informações Totais           │                                 │
│   ▼ Order summary              │                                 │
│     ☑ Subtotal do pedido       │                                 │
│     ☐ Desconto do pedido       │                                 │
│     ☐ Motivo do desconto       │                                 │
│   ▼ Shipping details           │                                 │
│     ☑ Envio do pedido          │                                 │
│     ☐ Nome da taxa de envio    │                                 │
│   ▼ Tax details                │                                 │
│     ☑ Imposto (excl.)          │                                 │
│     ☐ Duties                   │                                 │
│     ☐ Informações              │                                 │
│     ☐ Premium                  │                                 │
│     ☐ IMPOSTO/IVA/GST          │                                 │
│     ☐ Agrupar linhas imposto   │                                 │
│   ▼ Payment details            │                                 │
│     ☑ Pago pelo cliente        │                                 │
│     ☐ Valor do reembolso       │                                 │
│     ☐ Pagamento líquido        │                                 │
│     ☐ Saldo                    │                                 │
│                                │                                 │
│ ▼ Informações Adicionais       │                                 │
│   ▼ Barcode settings           │                                 │
│     ☐ Código de barras         │                                 │
│     ☐ Tipo: [QR Code ▾]       │                                 │
│   ▼ Additional information     │                                 │
│     ☐ Notas do pedido          │                                 │
│     ☐ Notas de rodapé          │                                 │
│     ☐ Assinatura               │                                 │
│                                │                                 │
│ ▼ Social Media                 │                                 │
│   Facebook: [____________]     │                                 │
│   Instagram: [____________]    │                                 │
│   Twitter: [____________]      │                                 │
│   LinkedIn: [____________]     │                                 │
│   Website: [____________]      │                                 │
└────────────────────────────────┴─────────────────────────────────┘
```

**Componentes Polaris:** `Page`, `Layout`, `Card`, `Checkbox`, `Collapsible`, `Select`, `TextField`, `FormLayout`

**Estrutura do `config` JSON (InvoiceTemplate.config):**

```typescript
interface TemplateConfig {
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
      showTaxLabel: boolean; // IMPOSTO/IVA/GST
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
```

**Comportamento do Preview:**
- Re-renderiza em tempo real a cada toggle de checkbox ou alteração de campo
- Usa dados de um pedido real da loja (sample order) como placeholder
- Se não houver pedidos, usa dados mock estáticos
- O preview deve ser um componente isolado que aceita `config` + `orderData` + `shopData`

**Actions:**
- `action("save")` → Salvar/atualizar template config no banco

**Critérios de aceite:**
- [ ] Todas as seções do editor são colapsáveis (accordion)
- [ ] Cada opção é um checkbox que liga/desliga o campo no preview
- [ ] Preview atualiza em tempo real (client-side, sem round-trip)
- [ ] Campos de texto (social media, notas) atualizam preview com debounce (300ms)
- [ ] Layout split 50/50 em desktop, stacked em mobile
- [ ] Preview usa dados reais de um pedido da loja
- [ ] Salvar persiste toda a config como JSON
- [ ] Template novo inicia com config padrão (campos essenciais ativados)

---

### 5.5 `app.pricing.tsx` — Planos

**Loader:**
- Autenticar admin
- Carregar `Shop` com plano atual
- Carregar todos os `Plan` do banco
- Retornar: `{ plans, currentPlan, shop }`

**UI:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Planos                                                          │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐│
│  │    FREE      │ │   BASIC     │ │    PRO      │ │   SCALE    ││
│  │              │ │             │ │             │ │            ││
│  │   Grátis     │ │   $9/mês    │ │  $19/mês    │ │  $39/mês   ││
│  │              │ │             │ │             │ │            ││
│  │ 30 invoices  │ │300 invoices │ │1000 invoices│ │ Ilimitado  ││
│  │              │ │             │ │             │ │            ││
│  │ [Atual]      │ │ [Assinar]   │ │ [Assinar]   │ │ [Assinar]  ││
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘│
│                                                                  │
│  Uso atual: 12/30 invoices neste ciclo                          │
│  ████████░░░░░░░░░░░░░ 40%                                      │
└──────────────────────────────────────────────────────────────────┘
```

**Componentes Polaris:** `Page`, `Layout`, `Card`, `Button`, `ProgressBar`, `Banner`

**Actions:**
- `action("subscribe")` → Criar subscription via Shopify Billing API → redirecionar para confirmação do Shopify
- `action("cancel")` → Cancelar subscription → downgrade para Free

**Fluxo de Billing:**
1. Merchant clica "Assinar" no plano desejado
2. Server cria `appSubscriptionCreate` mutation via GraphQL
3. Shopify retorna `confirmationUrl`
4. Redirect para `confirmationUrl` (merchant confirma no Shopify)
5. Webhook `app_subscriptions/update` atualiza o plano no banco

**Critérios de aceite:**
- [ ] Exibe os 4 planos com preços corretos
- [ ] Plano atual destacado visualmente
- [ ] Barra de progresso mostra uso atual vs limite
- [ ] Upgrade redireciona para confirmação do Shopify
- [ ] Downgrade para Free funciona
- [ ] Banner de aviso quando próximo do limite (>80%)

---

## 6. API Interna (Actions / Loaders)

### 6.1 GraphQL Queries (Shopify Admin API)

**Listar pedidos:**
```graphql
query GetOrders($first: Int!, $after: String) {
  orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
    edges {
      node {
        id
        name
        createdAt
        closedAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet { shopMoney { amount currencyCode } }
        subtotalPriceSet { shopMoney { amount currencyCode } }
        totalDiscountsSet { shopMoney { amount currencyCode } }
        customer {
          displayName
          email
          phone
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}
```

**Detalhes do pedido (para invoice):**
```graphql
query GetOrderForInvoice($id: ID!) {
  order(id: $id) {
    id
    name
    note
    tags
    createdAt
    closedAt
    poNumber
    displayFinancialStatus
    totalPriceSet { shopMoney { amount currencyCode } }
    subtotalPriceSet { shopMoney { amount currencyCode } }
    totalDiscountsSet { shopMoney { amount currencyCode } }
    totalShippingPriceSet { shopMoney { amount currencyCode } }
    totalTaxSet { shopMoney { amount currencyCode } }
    dutiesIncluded
    taxesIncluded
    totalRefundedSet { shopMoney { amount currencyCode } }
    netPaymentSet { shopMoney { amount currencyCode } }
    totalOutstandingSet { shopMoney { amount currencyCode } }
    customer {
      displayName
      email
      phone
    }
    billingAddress {
      formatted
      address1
      address2
      city
      province
      zip
      country
    }
    shippingAddress {
      formatted
      address1
      address2
      city
      province
      zip
      country
    }
    shippingLine {
      title
      originalPriceSet { shopMoney { amount currencyCode } }
    }
    lineItems(first: 50) {
      edges {
        node {
          name
          quantity
          sku
          variant {
            title
            weight
            weightUnit
            image { url altText }
            compareAtPrice
            price
          }
          product {
            productType
          }
          originalTotalSet { shopMoney { amount currencyCode } }
          discountedTotalSet { shopMoney { amount currencyCode } }
          totalDiscountSet { shopMoney { amount currencyCode } }
          taxLines {
            title
            rate
            priceSet { shopMoney { amount currencyCode } }
          }
          discountAllocations {
            allocatedAmountSet { shopMoney { amount currencyCode } }
            discountApplication {
              ... on DiscountCodeApplication { code }
              ... on ManualDiscountApplication { title }
              ... on AutomaticDiscountApplication { title }
            }
          }
        }
      }
    }
    transactions(first: 10) {
      kind
      gateway
      formattedGateway
      amountSet { shopMoney { amount currencyCode } }
      paymentDetails {
        ... on CardPaymentDetails {
          company
          number
        }
      }
    }
    taxLines {
      title
      rate
      priceSet { shopMoney { amount currencyCode } }
    }
    discountApplications(first: 10) {
      edges {
        node {
          ... on DiscountCodeApplication { code }
          ... on ManualDiscountApplication { title description }
          ... on AutomaticDiscountApplication { title }
          value {
            ... on MoneyV2 { amount currencyCode }
            ... on PricingPercentageValue { percentage }
          }
        }
      }
    }
  }
}
```

**Criar subscription (Billing):**
```graphql
mutation AppSubscriptionCreate($name: String!, $lineItems: [AppSubscriptionLineItemInput!]!, $returnUrl: URL!) {
  appSubscriptionCreate(name: $name, lineItems: $lineItems, returnUrl: $returnUrl, test: true) {
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
```

### 6.2 Server Utilities

```
app/
├── services/
│   ├── r2.server.ts          # Upload/download do Cloudflare R2
│   ├── postmark.server.ts    # Envio de emails via Postmark
│   ├── pdf.server.ts         # Geração de PDF da invoice
│   ├── billing.server.ts     # Lógica de billing/planos
│   └── invoice.server.ts     # CRUD de invoices, numeração sequencial
```

---

## 7. Geração de PDF

### Abordagem: HTML → PDF (server-side)

1. Componente React `InvoiceDocument` recebe `config`, `orderData`, `shopData`
2. Renderiza para HTML string com `renderToStaticMarkup`
3. CSS inline (sem dependência externa)
4. Converte HTML para PDF via `puppeteer` (headless Chrome)
5. Retorna Buffer do PDF

### Estrutura do PDF

```
┌─────────────────────────────┐
│  [LOGO]     NOME DA LOJA    │
│             email@loja.com  │
│                             │
│  Fatura: INV-0001           │
│  Pedido: #1001              │
│  Data: 01/01/2026           │
│                             │
│  Cobrar:        Enviar:     │
│  End. billing   End. envio  │
│                             │
│  ┌───┬────────┬─────┬─────┐ │
│  │Qtd│Produto │Preço│Total│ │
│  ├───┼────────┼─────┼─────┤ │
│  │ 2 │Camisa  │ $50 │$100 │ │
│  │   │SKU:123 │     │     │ │
│  └───┴────────┴─────┴─────┘ │
│                             │
│  Subtotal:       $100.00    │
│  Desconto:       -$10.00    │
│  Envio:            $5.00    │
│  Imposto:          $9.00    │
│  ────────────────────────   │
│  TOTAL:          $104.00    │
│                             │
│  Pago:           $104.00    │
│  Saldo:            $0.00    │
│                             │
│  [QR CODE / BARCODE]        │
│                             │
│  Notas: Obrigado pela compra│
│                             │
│  ─────── Assinatura ──────  │
│                             │
│  fb | ig | tw | li | web    │
└─────────────────────────────┘
```

---

## 8. Billing (Planos)

### Fluxo completo

```
Merchant entra no app
        │
        ▼
   Tem plano ativo?
   ┌────┴────┐
   Não       Sim
   │          │
   ▼          ▼
Assign      Verificar limite
Free plan   do ciclo atual
              │
        ┌─────┴─────┐
    Dentro do     Excedeu
     limite       limite
        │           │
        ▼           ▼
    Permitir     Mostrar banner
    gerar        "Upgrade necessário"
    invoice      Bloquear geração
```

### Controle de limites

- `shop.invoiceCount` incrementa a cada invoice gerada (PDF ou email)
- `shop.cycleStartAt` reseta quando o ciclo de billing renova (30 dias)
- Verificar: `shop.invoiceCount < plan.invoiceLimit` (ou `plan.invoiceLimit === null` para ilimitado)
- Webhook `app_subscriptions/update` atualiza plano e reseta contador

---

## 9. Fases de Desenvolvimento

### Fase 1 — Fundação (infraestrutura + dados)

| #   | Tarefa                                                   | Depende de |
| --- | -------------------------------------------------------- | ---------- |
| 1.1 | Migrar Prisma para PostgreSQL                            | —          |
| 1.2 | Criar models: Shop, Plan, InvoiceTemplate, Invoice       | 1.1        |
| 1.3 | Seed de planos (Free, Basic, Pro, Scale)                 | 1.2        |
| 1.4 | Atualizar scopes em `shopify.app.toml` (read_orders etc) | —          |
| 1.5 | Remover código demo (product generator, metaobjects)     | —          |
| 1.6 | Configurar variáveis de ambiente (R2, Postmark)          | —          |
| 1.7 | Implementar `r2.server.ts` (upload/download S3-compat)   | 1.6        |
| 1.8 | Implementar `postmark.server.ts` (envio de email)        | 1.6        |

**Entregável:** App limpo com DB pronta, integrações R2/Postmark funcionais.

---

### Fase 2 — Configurações + Billing

| #   | Tarefa                                                          | Depende de |
| --- | --------------------------------------------------------------- | ---------- |
| 2.1 | Página `app.settings.tsx` (logo + email)                        | 1.2, 1.7   |
| 2.2 | Upload de logo para R2 via DropZone                             | 2.1        |
| 2.3 | `billing.server.ts` — lógica de subscription                   | 1.2        |
| 2.4 | Página `app.pricing.tsx` (planos + barra de uso)                | 2.3        |
| 2.5 | Webhook `app_subscriptions/update` handler                      | 2.3        |
| 2.6 | Middleware de verificação de limites (guard de geração)          | 2.3        |

**Entregável:** Merchant pode configurar loja e assinar plano.

---

### Fase 3 — Template Engine

| #   | Tarefa                                                          | Depende de |
| --- | --------------------------------------------------------------- | ---------- |
| 3.1 | Definir `TemplateConfig` type + config padrão                   | —          |
| 3.2 | Componente `InvoicePreview` (renderiza config + dados)          | 3.1        |
| 3.3 | Página `app.templates.tsx` (listagem)                           | 1.2        |
| 3.4 | Página `app.templates.$id.tsx` (editor split-view)              | 3.1, 3.2   |
| 3.5 | Seção: Informações do Pedido (editor + preview)                 | 3.4        |
| 3.6 | Seção: Informações de Pagamento                                 | 3.4        |
| 3.7 | Seção: Informações de Envio                                     | 3.4        |
| 3.8 | Seção: Informações dos Itens                                    | 3.4        |
| 3.9 | Seção: Informações Totais do Pedido                             | 3.4        |
| 3.10| Seção: Informações Adicionais (barcode, notas, assinatura)      | 3.4        |
| 3.11| Seção: Social Media                                             | 3.4        |
| 3.12| Template padrão criado automaticamente para shops novas         | 3.1, 1.2   |

**Entregável:** Merchant pode criar e customizar templates com preview em tempo real.

---

### Fase 4 — Home + Invoices

| #   | Tarefa                                                           | Depende de     |
| --- | ---------------------------------------------------------------- | -------------- |
| 4.1 | Query GraphQL de pedidos (paginada)                              | 1.4            |
| 4.2 | Página `app._index.tsx` (lista de pedidos com IndexTable)        | 4.1            |
| 4.3 | `pdf.server.ts` — geração de PDF (HTML→Puppeteer)               | 3.2            |
| 4.4 | `invoice.server.ts` — CRUD + numeração sequencial                | 1.2            |
| 4.5 | Action "download PDF" (gerar + upload R2 + retornar URL)         | 4.3, 1.7, 4.4  |
| 4.6 | Action "enviar email" (gerar PDF + enviar via Postmark)          | 4.5, 1.8       |
| 4.7 | Verificação de limite antes de gerar invoice                     | 2.6            |
| 4.8 | Webhook `orders/updated` handler                                 | 4.4            |

**Entregável:** App funcional end-to-end. Merchant pode gerar e enviar invoices.

---

### Fase 5 — Polish + Produção

| #   | Tarefa                                                     | Depende de |
| --- | ---------------------------------------------------------- | ---------- |
| 5.1 | Tratamento de erros e edge cases em todas as páginas       | Fase 4     |
| 5.2 | Loading states e skeletons                                 | Fase 4     |
| 5.3 | Empty states (sem pedidos, sem templates)                  | Fase 4     |
| 5.4 | Responsividade mobile do editor                            | 3.4        |
| 5.5 | Internacionalização (moedas, formatos de data)             | Fase 4     |
| 5.6 | Rate limiting no envio de emails                           | 4.6        |
| 5.7 | Testes end-to-end                                          | Fase 4     |
| 5.8 | Setup do Dockerfile para produção com PostgreSQL           | Fase 1     |
| 5.9 | Revisão de segurança                                       | Fase 4     |
| 5.10| Submissão para Shopify App Store                           | Tudo       |

---

## 10. Critérios de Aceite Globais

| #  | Critério                                                                              |
| -- | ------------------------------------------------------------------------------------- |
| 1  | App embeddable no admin do Shopify sem erros de CORS ou iframe                        |
| 2  | Autenticação OAuth funciona em fluxo completo (install → auth → redirect → app)       |
| 3  | Todas as páginas usam Polaris components (sem UI customizada fora do padrão)           |
| 4  | PDFs gerados são válidos, legíveis e refletem fielmente o template configurado         |
| 5  | Emails chegam via Postmark com PDF em anexo sem cair em spam                          |
| 6  | Billing funciona com planos test=true no dev e test=false em produção                 |
| 7  | Upload de logo funciona com arquivos até 2MB (PNG, JPG, SVG)                          |
| 8  | Limites de plano são respeitados — app bloqueia geração quando excede                 |
| 9  | Navegação entre páginas é fluida (sem full-page reload)                               |
| 10 | App funciona em shops com 0 pedidos (empty states adequados)                          |
| 11 | App funciona em shops com 10.000+ pedidos (paginação eficiente)                       |
| 12 | Webhooks processam corretamente uninstall, scope update e order update                |
| 13 | Dados da shop são limpos no uninstall (GDPR compliance)                               |
| 14 | Nenhum secret hardcoded no código (tudo via env vars)                                 |

---

## Apêndice: Estrutura Final de Arquivos

```
app/
├── routes/
│   ├── _index/
│   │   ├── route.tsx              # Landing page pública
│   │   └── styles.module.css
│   ├── app.tsx                    # Layout autenticado
│   ├── app._index.tsx             # Home — Lista de pedidos
│   ├── app.settings.tsx           # Configurações (logo + email)
│   ├── app.templates.tsx          # Lista de templates
│   ├── app.templates.$id.tsx      # Editor de template
│   ├── app.pricing.tsx            # Planos e billing
│   ├── auth.$.tsx
│   ├── auth.login/
│   │   ├── route.tsx
│   │   └── error.server.tsx
│   ├── webhooks.app.uninstalled.tsx
│   ├── webhooks.app.scopes_update.tsx
│   ├── webhooks.orders.updated.tsx
│   └── webhooks.app-subscriptions.update.tsx
├── components/
│   ├── InvoicePreview.tsx         # Preview renderizado da invoice
│   ├── TemplateEditor.tsx         # Painel de edição do template
│   └── PlanCard.tsx               # Card de plano individual
├── services/
│   ├── r2.server.ts               # Cloudflare R2 (S3-compat)
│   ├── postmark.server.ts         # Envio de email
│   ├── pdf.server.ts              # Geração de PDF
│   ├── billing.server.ts          # Billing API
│   └── invoice.server.ts          # CRUD de invoices
├── types/
│   ├── template.ts                # TemplateConfig interface
│   └── admin.generated.d.ts       # GraphQL codegen
├── db.server.ts
├── shopify.server.ts
├── root.tsx
└── entry.server.tsx

prisma/
├── schema.prisma
├── seed.ts
└── migrations/

extensions/                        # (vazio por agora)
```
