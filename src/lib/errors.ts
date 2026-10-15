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

interface AuthErrorLike {
  message: string;
  code?: string;
}

/** Same idea as dbError, for Supabase Auth errors (sign-up, invites). Known cases get plain wording. */
export function authError(error: AuthErrorLike): string {
  switch (error.code) {
    case "weak_password":
      return "That password is too weak. Use at least 8 characters with a mix of letters and numbers.";
    case "email_exists":
    case "user_already_exists":
      return "An account with this email already exists.";
    case "email_address_invalid":
    case "validation_failed":
      return "That email address doesn't look right. Check it and try again.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "We've sent a lot of emails in the last few minutes. Please wait a little and try again.";
    case "email_address_not_authorized":
      return "We can't send email to that address yet. Try a different one, or contact support.";
    default:
      console.error("[auth error]", error.code ?? "", error.message);
      Sentry.captureException(new Error(`Auth error ${error.code ?? ""}: ${error.message}`));
      return "Something went wrong. Please try again, and contact support if it keeps happening.";
  }
}
