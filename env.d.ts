/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

interface ProcessEnv {
  DATABASE_URL: string;
  SHOPIFY_API_KEY: string;
  SHOPIFY_API_SECRET: string;
  SHOPIFY_APP_URL: string;
  SCOPES: string;
  SHOP_CUSTOM_DOMAIN?: string;
  POSTMARK_SERVER_TOKEN: string;
  POSTMARK_FROM_EMAIL: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
  R2_PUBLIC_URL: string;
}
