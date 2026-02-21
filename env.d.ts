/// <reference types="@cloudflare/workers-types" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

type CloudflareEnv = {
  DB: D1Database;
  APP_SECRET: string;
  SESSION_TTL_HOURS?: string;
};

declare module '@cloudflare/next-on-pages' {
  export function getRequestContext(): {
    env: CloudflareEnv;
    cf: IncomingRequestCfProperties | undefined;
    ctx: ExecutionContext;
  };
  export function getOptionalRequestContext(): {
    env: CloudflareEnv;
    cf: IncomingRequestCfProperties | undefined;
    ctx: ExecutionContext;
  } | undefined;
}
