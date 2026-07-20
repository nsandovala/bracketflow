import type { Metadata } from "next";
import "./globals.css";
import BackgroundParticles from "./components/BackgroundParticles";

export const metadata: Metadata = {
  title: "BracketFlow",
  description: "MVP para gestionar torneos esports",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <BackgroundParticles />
        <div className="bf-app-shell">{children}</div>
      </body>
    </html>
  );
}
