/**
 * Short-lived cookie a route handler sets before redirecting, so the next page can
 * show a one-off toast (components/flash-toast.tsx). Value is `kind[:detail]`.
 */
export const FLASH_COOKIE = "bk_flash";

export type FlashKind = "confirmed" | "confirmed-sign-in";
