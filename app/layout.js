import './globals.css';
import { Providers } from './providers';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>DataFlow - Data Pipeline Management</title>
        <meta name="description" content="Enterprise data pipeline management platform" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}