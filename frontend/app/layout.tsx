import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRCE Automation — ForAudits",
  description: "Automatize os seus relatórios PRCE ao abrigo do RGCEST / Portaria 228/90",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
