import './globals.css'

export const metadata = {
  title: 'DataFlow - Data Pipeline Management',
  description: 'Enterprise data pipeline management platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}