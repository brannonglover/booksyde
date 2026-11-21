/**
 * The Booksyde website, which the app calls for things it can't do alone
 * (today's pick, adding a book from Open Library) and links to (password
 * resets, sign-up confirmation emails).
 *
 * We build against what's live, so this is the live site unless
 * EXPO_PUBLIC_WEB_URL says otherwise. A local address (to try an endpoint before
 * it's deployed) is honoured only in development: the variable is read when the
 * app is bundled, so a release built on a laptop would otherwise ship that
 * laptop's dev server, and on a phone localhost is the phone itself.
 */
const LIVE_SITE = 'https://www.booksyde.co';

const configured = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, '') || undefined;
const isLocal = (url: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(url);

export const webUrl: string = configured && (__DEV__ || !isLocal(configured)) ? configured : LIVE_SITE;
