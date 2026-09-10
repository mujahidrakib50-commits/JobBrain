import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JobBrain — Autonomous Job Application Submitter",
  description: "Automated job applications powered by your personal brain and verified profile data.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico" },
    ],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-gray-200 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
