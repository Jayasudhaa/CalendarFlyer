FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY temple-calendar/package*.json ./
RUN npm ci
COPY temple-calendar/ ./
RUN npm run build
FROM node:22-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=frontend /frontend/dist ./dist-frontend
ENV NODE_ENV=production PORT=5000
USER node
EXPOSE 5000
CMD ["node", "server.js"]
