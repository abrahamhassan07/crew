import "server-only";
import * as Sentry from "@sentry/nextjs";

interface DbErrorLike {
  message: string;
  code?: string;
}

/**
 * Turns a database error into something safe to show a user. The raw message can name tables,
 * columns and constraints, so it is logged (and reported to Sentry) instead of being returned.
 * Errors raised on purpose by our own database triggers (code P0001) are written for users and pass through.
 */
export function dbError(error: DbErrorLike): string {
  if (error.code === "P0001") return error.message;

  console.error("[db error]", error.code ?? "", error.message);
  Sentry.captureException(new Error(`Database error ${error.code ?? ""}: ${error.message}`));

  switch (error.code) {
    case "23505":
      return "That already exists. Check for a duplicate and try again.";
    case "23503":
      return "That can't be saved or removed because it's linked to other records.";
    case "23502":
    case "23514":
    case "22P02":
    case "22001":
      return "Some of the details aren't valid. Check the form and try again.";
    case "42501":
    case "PGRST301":
      return "You don't have permission to do that.";
    default:
      return /row-level security/i.test(error.message)
        ? "You don't have permission to do that."
        : "Something went wrong. Please try again, and contact support if it keeps happening.";
  }
}
