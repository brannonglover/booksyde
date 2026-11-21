import type { Metadata } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import { toCssVariables } from "@booksyde/theme";
import { TrackClicks } from "@/components/analytics";
import { FlashToast } from "@/components/flash-toast";
import { isProduction, siteUrl } from "@/lib/site";
import { seasonInitScript, themeInitScript } from "@/lib/theme-script";
import "./globals.css";

// Instrument Serif: old-book letterforms with modern, editorial proportions.
const display = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const body = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

const description = "Track what you read, find books by mood and trope, and read along with friends.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Booksyde — settle in with your next favorite book", template: "%s · Booksyde" },
  description,
  applicationName: "Booksyde",
  openGraph: { type: "website", siteName: "Booksyde", locale: "en_US", description },
  twitter: { card: "summary_large_image" },
  // Set GOOGLE_SITE_VERIFICATION to the token from Search Console's "HTML tag" method.
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  robots: isProduction ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript + seasonInitScript }} />
        <style dangerouslySetInnerHTML={{ __html: toCssVariables() }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <FlashToast />
        <TrackClicks />
      </body>
    </html>
  );
}
