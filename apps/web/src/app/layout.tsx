import type { Metadata } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import { toCssVariables } from "@booksyde/theme";
import { FlashToast } from "@/components/flash-toast";
import { themeInitScript } from "@/lib/theme-script";
import "./globals.css";

// Instrument Serif: old-book letterforms with modern, editorial proportions.
const display = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const body = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Booksyde — settle in with your next favorite book", template: "%s · Booksyde" },
  description: "Track what you read, find books by mood and trope, and read along with friends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${body.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <style dangerouslySetInnerHTML={{ __html: toCssVariables() }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <FlashToast />
      </body>
    </html>
  );
}
