# PharmaTrack - Pharmacy Inventory Management System

A modern, mobile-friendly full-stack web application for retail pharmacies to manage medicines, track expiry dates, manage sales, and receive alerts.

## 🚀 One-Click Vercel Deployment

This repository is ready for direct deployment on **[Vercel](https://vercel.com)**:

1. Import this repository into Vercel at [vercel.com/new](https://vercel.com/new).
2. Set the following **Environment Variables** in Vercel project settings:
   - `MONGODB_URI`: Your MongoDB Atlas URI (e.g., `mongodb+srv://user:password@cluster.mongodb.net/pharmacy-inventory`)
   - `JWT_SECRET`: A secure random secret key (e.g., generated with `openssl rand -hex 32`)
   - `NODE_ENV`: `production`
3. Click **Deploy**!

> **Note**: Both deploying from repository root (`.`) and specifying root directory as `pharmacy-inventory` are supported out of the box with dedicated `vercel.json` configurations.

---

## 🌐 Local Network Access (All IP Addresses: 0.0.0.0)

PharmaTrack is configured to listen on `0.0.0.0`, allowing access from any device on your Wi-Fi/LAN (smartphones, tablets, other PCs, barcode scanners):

- **Localhost**: [http://localhost:3000](http://localhost:3000)
- **Local Network**: `http://<YOUR_IP>:3000` (e.g. `http://192.168.0.133:3000`)
- **Backend API**: `http://<YOUR_IP>:5001/api`
- **Health Check**: `http://<YOUR_IP>:5001/api/health`

### Starting the Application Locally

```bash
# Easy start script (auto-detects and prints your LAN IP)
cd pharmacy-inventory
./start.sh        # macOS / Linux
# or start.bat on Windows
```

Or using npm:
```bash
# Install and build
npm run setup --prefix pharmacy-inventory
npm run build --prefix pharmacy-inventory

# Single-port production server on 0.0.0.0:5001
npm start --prefix pharmacy-inventory
```

For more documentation, see [pharmacy-inventory/README.md](file:///Users/sahilchadha/medical/pharmacy-inventory/README.md).
