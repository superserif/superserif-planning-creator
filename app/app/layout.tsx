import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lineup — Planning du studio",
  description: "L'année du studio, projet par projet.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <div className="isolate flex flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
