import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "../app/globals.css" // Import global CSS

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Multi-Symbol Trading Analysis Dashboard",
  description: "AI-powered trading analysis dashboard for multiple symbols.",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
