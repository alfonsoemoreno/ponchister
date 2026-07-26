import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import MuiRegistry from "./mui-registry";

export const metadata = {
  title: "Ponchister",
  description: "Aplicacion musical para los amigos",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <MuiRegistry>{children}</MuiRegistry>
        <SpeedInsights />
      </body>
    </html>
  );
}
