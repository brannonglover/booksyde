import { z } from "zod";
import { usernameSchema } from "./profile";

export const emailSchema = z.string().trim().toLowerCase().email("That doesn’t look like an email address");
export const passwordSchema = z.string().min(8, "Use at least 8 characters");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "What should we call you?").max(60, "Keep it under 60 characters"),
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

/** Field name → first error message, for showing under each input. */
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function fieldErrors<T>(error: z.ZodError<T>): FieldErrors<T> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out as FieldErrors<T>;
}

/** Turns Supabase Auth errors into friendly, non-technical sentences. */
export function authErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  const code = error?.code ?? "";
  const message = (error?.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || message.includes("invalid login credentials")) {
    return "That email and password don’t match. Try again?";
  }
  if (code === "email_not_confirmed") return "Check your inbox first: we sent you a link to confirm your email.";
  if (code === "user_already_exists" || message.includes("already registered")) {
    return "There’s already an account with that email. Try signing in instead.";
  }
  if (code === "weak_password") return "Choose a stronger password: at least 8 characters, not easy to guess.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || message.includes("rate limit")) {
    return "Too many tries in a row. Wait a minute, then try again.";
  }
  if (code === "otp_expired") return "That link has expired. Ask for a new one.";
  if (code === "signup_disabled") return "New sign-ups are paused right now.";
  // Supabase couldn't hand the email to our SMTP provider (e.g. "Error sending confirmation email").
  if (message.startsWith("error sending")) return "We couldn’t send you an email just now. Please try again in a few minutes.";
  return "Something went wrong on our side. Please try again.";
}
