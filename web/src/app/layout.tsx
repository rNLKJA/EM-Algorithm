import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "katex/dist/katex.min.css";
import "./globals.css";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { site } from "@/lib/site";

// Self-hosted (next/font/local) so builds never fetch Google Fonts. Latin (and, for
// Plex Sans, Greek) woff2 files from the @fontsource packages; OFL licences sit
// next to them in ./fonts.
const fraunces = localFont({
  variable: "--font-fraunces",
  display: "swap",
  src: [
    { path: "./fonts/fraunces-latin-opsz-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./fonts/fraunces-latin-opsz-italic.woff2", weight: "100 900", style: "italic" },
  ],
  fallback: ["Georgia", "serif"],
});

const plexSans = localFont({
  variable: "--font-plex-sans",
  display: "swap",
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  // No metric-adjusted fallback face: it would claim the Greek letters before
  // the Plex Greek family below gets a chance (see --font-sans in globals.css).
  adjustFontFallback: false,
});

// Greek glyphs (π, μ, σ, γ...) from the same family, used as the next font in the stack.
const plexGreek = localFont({
  variable: "--font-plex-greek",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/ibm-plex-sans-greek-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-greek-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/ibm-plex-sans-greek-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-greek-600-normal.woff2", weight: "600", style: "normal" },
  ],
  adjustFontFallback: false,
});

const plexMono = localFont({
  variable: "--font-plex-mono",
  display: "swap",
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  adjustFontFallback: false,
});

const caveat = localFont({
  variable: "--font-caveat",
  display: "swap",
  preload: false,
  src: [{ path: "./fonts/caveat-latin-wght-normal.woff2", weight: "400 700", style: "normal" }],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} · EM algorithm lab`,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  applicationName: site.shortName,
  authors: [{ name: site.author, url: site.authorGithub }],
  keywords: [
    "EM algorithm",
    "expectation maximisation",
    "Gaussian mixture",
    "statistics",
    "interactive explainer",
  ],
  openGraph: {
    title: site.name,
    description: site.description,
    type: "website",
    siteName: site.name,
    locale: "en_AU",
  },
  twitter: { card: "summary_large_image", title: site.name, description: site.description },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e7" },
    { media: "(prefers-color-scheme: dark)", color: "#172124" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AU"
      suppressHydrationWarning
      className={`${fraunces.variable} ${plexSans.variable} ${plexGreek.variable} ${plexMono.variable} ${caveat.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider delayDuration={150}>
            <a
              href="#main"
              className="sr-only z-50 rounded-md bg-primary text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
            >
              Skip to content
            </a>
            <SiteHeader />
            <main id="main" className="flex-1">
              {children}
            </main>
            <SiteFooter />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
