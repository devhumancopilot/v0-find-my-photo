export const metadata = {
  title: 'Find My Photo API Server',
  description: 'Backend API server for Find My Photo application',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
