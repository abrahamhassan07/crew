import * as Sentry from "@sentry/nextjs";

// Inert until SENTRY_DSN is set, so local dev and the pilot run without it.
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  Sentry.init({
    dsn,
    enabled: !!dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Keep session cookies, headers, request bodies (client records) and user identity out of error reports.
  dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
  });
}

export const onRequestError = Sentry.captureRequestError;
