import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari, Noto_Sans_Telugu } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { THEME_KEY } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const deva = Noto_Sans_Devanagari({ subsets: ["devanagari"], variable: "--font-deva", weight: ["400", "500", "600", "700"], display: "swap", preload: false });
const telugu = Noto_Sans_Telugu({ subsets: ["telugu"], variable: "--font-telugu", weight: ["400", "500", "600", "700"], display: "swap", preload: false });

export const metadata: Metadata = {
  title: {
    default: "CreditBridge — Credit decisions from cash flow",
    template: "%s · CreditBridge",
  },
  description:
    "CreditBridge turns 6–12 months of bank statement data into a verified, explainable credit decision for people without a credit history.",
  appleWebApp: { capable: true, title: "CreditBridge", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Applied before paint so the stored or system appearance never flashes.
const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${inter.variable} ${deva.variable} ${telugu.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:shadow-card"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
