import './globals.css'
import { Providers } from './providers';

export const metadata = {
  title: 'DataFlow - Data Pipeline Management',
  description: 'Enterprise data pipeline management platform',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}