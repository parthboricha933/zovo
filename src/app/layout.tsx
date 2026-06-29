import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ZOVO — Ride. Connect. Explore.",
  description:
    "ZOVO connects drivers with empty seats to passengers going the same way. Book a ride, offer a seat, travel together.",
  keywords: ["ZOVO", "ride-sharing", "carpool", "travel", "driver", "passenger"],
  authors: [{ name: "ZOVO Team" }],
  icons: {
    icon: "/zovo.png",
    apple: "/zovo.png",
  },
  openGraph: {
    title: "ZOVO — Ride. Connect. Explore.",
    description: "Real-time ride-sharing with live GPS tracking, OTP ride starts, and in-app chat.",
    siteName: "ZOVO",
    type: "website",
    images: ["/zovo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ZOVO",
    description: "Ride. Connect. Explore.",
    images: ["/zovo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Identity Services for Google Sign-In */}
        <script async defer src="https://accounts.google.com/gsi/client" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
