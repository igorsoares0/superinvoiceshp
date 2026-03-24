import { ServerClient } from "postmark";

let _client: ServerClient | null = null;

function getClient(): ServerClient {
  if (!_client) {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    if (!token) {
      throw new Error("POSTMARK_SERVER_TOKEN não configurado. Adicione ao .env para enviar emails.");
    }
    _client = new ServerClient(token);
  }
  return _client;
}

interface SendInvoiceEmailParams {
  to: string;
  fromEmail?: string;
  shopName: string;
  invoiceNumber: string;
  pdfBuffer: Buffer;
}

export async function sendInvoiceEmail({
  to,
  fromEmail,
  shopName,
  invoiceNumber,
  pdfBuffer,
}: SendInvoiceEmailParams) {
  const from = fromEmail || process.env.POSTMARK_FROM_EMAIL!;

  const response = await getClient().sendEmail({
    From: from,
    To: to,
    Subject: `Invoice ${invoiceNumber} from ${shopName}`,
    HtmlBody: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Invoice ${invoiceNumber}</h2>
        <p>Hello,</p>
        <p>Please find attached invoice <strong>${invoiceNumber}</strong> from <strong>${shopName}</strong>.</p>
        <p>If you have any questions, please reply to this email.</p>
        <p>Thank you,<br/>${shopName}</p>
      </div>
    `,
    Attachments: [
      {
        Name: `${invoiceNumber}.pdf`,
        Content: pdfBuffer.toString("base64"),
        ContentType: "application/pdf",
        ContentID: null as unknown as string,
      },
    ],
  });

  return response;
}
