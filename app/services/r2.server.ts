import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

let _s3: S3Client | null = null;

function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

function getBucket(): string {
  return process.env.R2_BUCKET_NAME!;
}

function getPublicUrl(): string {
  return process.env.R2_PUBLIC_URL!;
}

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return `${getPublicUrl()}/${key}`;
}

export async function deleteFile(key: string): Promise<void> {
  await getS3().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );
}

export async function getFile(key: string): Promise<Buffer> {
  const response = await getS3().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: key,
    }),
  );

  const chunks: Uint8Array[] = [];
  const stream = response.Body as AsyncIterable<Uint8Array>;
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function getLogoKey(shopId: string, filename: string): string {
  return `logos/${shopId}/${filename}`;
}

export function getInvoicePdfKey(shopId: string, invoiceId: string): string {
  return `invoices/${shopId}/${invoiceId}.pdf`;
}
