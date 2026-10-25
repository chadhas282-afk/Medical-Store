# PharmaTrack - Pharmacy Inventory Management System

A modern, mobile-friendly web application for small retail pharmacies to manage medicine inventory, track expiry dates, and receive automated alerts.

## Features

- **Medicine Management**: Add, edit, and delete medicines with batch numbers, expiry dates, pricing, and stock levels
- **Automated Alerts**: Real-time dashboard showing:
  - Expired medicines (immediate action required)
  - Medicines expiring within 30 days
  - Medicines expiring in 31-60 days
  - Low stock alerts (configurable threshold)
- **Dashboard**: Overview with statistics, recent medicines, and alert summary
- **Search & Filter**: Find medicines by name, batch, category, or status
- **Data Export/Import**: Backup and restore inventory data as CSV or JSON
- **Mobile-First Design**: Fully responsive, works great on phones and tablets
- **Accessible**: WCAG 2.1 AA compliant with keyboard navigation and screen reader support

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express
- **Database**: MongoDB (Mongoose ODM)
- **Styling**: Custom CSS with CSS Variables (no framework)
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Project Structure

```
pharmacy-inventory/
├── backend/
│   ├── server.js          # Express server with all API routes
│   ├── package.json
│   └── .env               # Environment variables
└── frontend/
    ├── src/
    │   ├── components/    # Reusable UI components
    │   ├── pages/         # Page components
    │   ├── context/       # React context providers
    │   ├── utils/         # Utility functions & API client
    │   ├── App.jsx        # Main app with routing
    │   ├── main.jsx       # Entry point
    │   └── index.css      # Global styles
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## Prerequisites

- Node.js 18+
- MongoDB (local or cloud)
- npm or yarn

## Installation & Setup

### 1. Backend Setup

```bash
cd pharmacy-inventory/backend
npm install
```

Create `.env` file (already included):
```
MONGODB_URI=mongodb://localhost:27017/pharmacy-inventory
PORT=5000
```

Start MongoDB (if running locally):
```bash
# macOS with Homebrew
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Or use MongoDB Atlas cloud connection string in .env
```

Start backend server:
```bash
npm run dev
# Server runs on http://localhost:5000
```

### 2. Frontend Setup

```bash
cd pharmacy-inventory/frontend
npm install
```

Start development server:
```bash
npm run dev
# Frontend runs on http://localhost:3000
```

The Vite dev server proxies API requests to the backend automatically.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/medicines` | List medicines (with pagination, search, filters) |
| GET | `/api/medicines/stats` | Dashboard statistics |
| GET | `/api/medicines/alerts` | Get all alerts (expired, expiring, low stock) |
| GET | `/api/medicines/:id` | Get single medicine |
| POST | `/api/medicines` | Create new medicine |
| PUT | `/api/medicines/:id` | Update medicine |
| PATCH | `/api/medicines/:id/stock` | Update stock quantity only |
| DELETE | `/api/medicines/:id` | Delete medicine |
| GET | `/api/categories` | List all categories |

## Usage Guide

### Adding Medicines
1. Click "Add Medicine" from sidebar or dashboard
2. Fill in required fields (name, category, batch number, quantity, price, expiry date)
3. Optional: generic name, manufacturer, manufacturing date, location, notes, low stock threshold
4. Click "Add Medicine"

### Managing Alerts
- **Dashboard**: See alert summary cards with counts
- **Alerts Page**: Detailed view with tabs for each alert type
- Click any alert to edit the medicine directly

### Low Stock Threshold
Each medicine has a configurable threshold (default: 10). When quantity falls below this, it appears in low stock alerts.

### Data Backup
- **Settings → Data Management → Export Data**: Downloads complete backup as JSON
- **Settings → Data Management → Import Data**: Restore from backup file

## Production Deployment

### Deploying to Vercel (Recommended)

PharmaTrack is pre-configured for one-click or zero-configuration deployment to [Vercel](https://vercel.com):

1. **Push your code to GitHub / GitLab / Bitbucket**.
2. **Import the repository into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and select your repository.
   - You can leave **Root Directory** as default (`.`) or set it to `pharmacy-inventory` (both are supported!).
3. **Configure Environment Variables** in the Vercel Dashboard:
   - `MONGODB_URI`: Your MongoDB Atlas connection string (e.g., `mongodb+srv://user:pass@cluster.mongodb.net/pharmacy-inventory?retryWrites=true&w=majority`)
   - `JWT_SECRET`: A secure random string (generate one with `openssl rand -hex 32`)
   - `NODE_ENV`: `production`
4. **Deploy**:
   - Click **Deploy**. Vercel will build the frontend with Vite and host the Express API as serverless functions.
   - Your full-stack app is now live with global edge caching and automatic SSL!

### Accessing the App on All IP Addresses (LAN / Mobile / Local Network)

Both the frontend Vite dev server and the backend Express server are configured to listen on `0.0.0.0` (all network interfaces and IP addresses):

- **Local Access**: `http://localhost:3000`
- **Network / Mobile Access**: `http://<YOUR_LOCAL_IP>:3000` (e.g., `http://192.168.0.133:3000`)
- **Backend API Direct Access**: `http://<YOUR_LOCAL_IP>:5001/api`
- **Health Check**: `http://<YOUR_LOCAL_IP>:5001/api/health`

Any device connected to the same Wi-Fi / LAN network (smartphones, barcode scanners, iPads, cashier computers) can access PharmaTrack using your machine's IP address.

### Self-Hosted / Single-Port Node.js Deployment

You can also run both frontend and backend on a single port (5001) on any VPS or local machine:

```bash
# Build frontend
npm run build

# Start single-service server (serves frontend static files and /api routes on 0.0.0.0)
npm start
```

### Docker (Optional)
```dockerfile
# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5001
CMD ["node", "server.js"]
```

## Environment Variables

### Backend (`backend/.env` or Vercel Environment Variables)
| Variable | Description | Default |
|----------|-------------|---------|
| `HOST` | Bind address for network interfaces | `0.0.0.0` (All IP addresses) |
| `PORT` | Server listening port | `5001` (or assigned by platform) |
| `MONGODB_URI` | MongoDB connection string (Atlas for cloud/Vercel) | `mongodb://localhost:27017/pharmacy-inventory` |
| `JWT_SECRET` | Secret key for JWT auth tokens | Dev fallback (required in production) |
| `NODE_ENV` | Environment mode (`development` / `production`) | `development` |

### Frontend (`frontend/.env` - Optional)
| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Base path/URL for API calls | `/api` |
| `VITE_BACKEND_URL` | Vite dev proxy target backend | `http://localhost:5001` |

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Accessibility

- Semantic HTML5
- ARIA labels and roles
- Keyboard navigation support
- Focus management
- Color contrast ratios (WCAG AA)
- Skip to main content link
- Screen reader announcements for alerts

## License

MIT License - Feel free to use for your pharmacy!

## Support

For issues or feature requests, please create an issue in the repository.