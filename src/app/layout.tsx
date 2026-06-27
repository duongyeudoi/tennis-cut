import type { Metadata } from "next";
import { Barlow, Bebas_Neue, Geist_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rallies Cut",
  description: "Tự động cắt rally tennis từ video trận đấu",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();

  return (
    <html
      lang="vi"
      className={`${barlow.variable} ${bebasNeue.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <TooltipProvider>
            <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-sm">
              <div className="max-w-3xl mx-auto px-4 h-11 flex items-center justify-between">
                <span
                  className="text-sm font-semibold"
                  style={{ fontFamily: "var(--font-bebas)", letterSpacing: "0.08em" }}
                >
                  Rallies<span style={{ color: "var(--sport)" }}>Cut</span>
                </span>
                <div className="flex items-center gap-1">
                  {user && <UserMenu email={user.email ?? ""} />}
                  <ThemeToggle />
                </div>
              </div>
            </header>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
