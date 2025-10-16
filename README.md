# DataFlow - Data Pipeline Management Platform

Enterprise data pipeline management platform for moving data between systems.

## Features

- 🔐 Multi-tenant team-based access control
- 🔌 Multiple data source/target support (Database, SFTP, Excel, CSV)
- 🔍 Data Explorer for testing queries
- 📊 Task management and execution
- 📈 Real-time dashboard and monitoring
- 🧪 Connection testing

## Quick Start

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Set Up Environment Variables
\`\`\`bash
cp .env.local.example .env.local
# Edit .env.local with your database URL and secrets
\`\`\`

### 3. Set Up Database
Run the SQL schema from \`schema.sql\` in your PostgreSQL database.

### 4. Run Development Server
\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000)

### 5. Default Login
- Email: admin@example.com
- Password: password123

## Deployment

### Deploy to Vercel
\`\`\`bash
vercel --prod
\`\`\`

Add environment variables in Vercel dashboard.

## Tech Stack

- Next.js 14
- React 18
- PostgreSQL
- Tailwind CSS
- Lucide Icons

## License

Proprietary