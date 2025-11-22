export const metadata = {
  title: "Miedăria Păunilor",
  description: "Miedăria Păunilor - Official Website",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
