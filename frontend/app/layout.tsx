import type { Metadata } from "next";
import { Host_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";
import { GradientBackground } from "@/components/GradientBackground";

const font = Host_Grotesk({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "YouTube Clipper",
  description: "Clip sections from YouTube videos and download them locally.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📼</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${font.className} antialiased min-h-screen`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <GradientBackground />
          {children}
          <Toaster expand visibleToasts={6} position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
