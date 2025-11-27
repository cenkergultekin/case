import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ImageFlow - AI Image Processing",
  description: "Transform your images with AI-powered tools. Professional image editing, rotation, and upscaling made simple.",
  keywords: ["AI", "image processing", "image editing", "upscaling", "rotation"],
  authors: [{ name: "ImageFlow" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full`}>{children}</body>
    </html>
  );
}
