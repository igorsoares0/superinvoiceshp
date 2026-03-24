# app shopify público pra gerência, envio de invoices.

## página home:

- Listagem de todos os pedidos da loja. mostrar os dados: nome(número pedido), cliente, subtotal, desconto, total, status. ações: download em pdf, enviar por email.

## página configs:

- add logo;  
- add  email profissional da loja.

## página invoice template listing:

- lista todos os modelos de fatura; 

## página de planos:

- Free → 30 invoices  
- Basic → 300 ($9)  
- Pro → 1000 ($19)  
- Scale → ilimitado($39)

## página editor de invoice template(deve ter o editor do lado esquerdo e o preview em real time da invoice no lado direito): 

- informações do pedido: número do pedido, número da fatura, purchase order number, data do pedido, data de fechamento, valor do pedido, etiquetas do pedido.  
- informações de pagamento: endereço de pagamento, método de pagamento, cartão de crédito.  
- informações de envio: endereço de envio, email do cliente, telefone do cliente.  
- informações dos itens: detalhes do produtos(mostrar imagem do produto, mostrar sku do produto, mostrar peso do produto, mostrar variante do produto, mostrar tipo de produto), Pricing and discounts(Mostrar desconto, Mostrar motivo do desconto, Mostrar preço de comparação, Preço do item sem incluir impostos, Preço do item após desconto), Quantity and tax(Mostrar quantidade total, Mostrar imposto total do item).  
- informações totais do pedido: Order summary(Subtotal do pedido, Desconto do pedido, Motivo do desconto do pedido), Shipping details(Envio do pedido, Nome da taxa de envio do pedido), Tax details(Pedido excluindo impostos, Duties, Informações, Premium, IMPOSTO/IVA/GST, Agrupar linhas de imposto), Payment details(Pedido pago pelo cliente, Valor do reembolso do pedido, Pagamento líquido do pedido, Saldo).  
- informações adicionais: Barcode settings(Código de barras do pedido, Selecionar tipo de código de barras(qr code, Barcode (Code 128), Barcode (Code 39)), Additional information(Notas do pedido, Notas de pie de página, signature)  
- social media.

### instruções gerais:

\*use polaris;  
\*use postgres;  
\*pesquise nas docs oficiais conforme necessário;  
\*use postmark para enviar as faturas por email;  
\*use billing api;  
\*use R2(cloudflare)