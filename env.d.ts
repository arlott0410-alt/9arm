/// <reference types="@cloudflare/workers-types" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Run `npm run cf-typegen` to generate from wrangler.jsonc
interface CloudflareEnv {
  DB: D1Database;
  APP_SECRET: string;
  SESSION_TTL_HOURS?: string;
  SUPERADMIN_USERNAME?: string;
  SUPERADMIN_PASSWORD?: string;
}
