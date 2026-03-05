FROM node:18-alpine
WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm install --production

# Copy backend source
COPY . .

# Copy pre-built React frontend (copied into server folder before docker build)
# server.js serves this at / in production mode
COPY dist-frontend ./temple-calendar/dist

EXPOSE 5000
CMD ["node", "server.js"]