# Syntax: build both stages, run the backend (it serves frontend/dist)
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./../frontend/dist
WORKDIR /app/backend
EXPOSE 5001
CMD ["node", "server.js"]
