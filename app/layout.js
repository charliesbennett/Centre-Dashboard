import "./globals.css";

export const metadata = {
  title: "UKLC Centre Dashboard",
  description: "Centre operations management for UK Language Centres",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-jakarta bg-gray-50 text-uklc-navy min-h-screen">
        {children}
      </body>
    </html>
  );
}
