FROM node:18-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# server.js listens on process.env.PORT, defaulting to 5000 (see .env —
# which is NOT copied into this image, per .dockerignore, so that default
# is what actually applies unless the deployment platform injects its own
# PORT). This EXPOSE previously said 8080, which didn't match either the
# code's default or the local .env — harmless for `docker run -P` but
# actively wrong documentation for anyone (or any platform) wiring up
# port mapping from it. Keep this value, the ENV below, and whatever port
# your AWS App Runner service (see instance-config.json) is configured to
# route traffic to all in sync — if you'd rather standardize on 8080,
# change ENV PORT below instead of just this line.
ENV PORT=5000
EXPOSE 5000
CMD ["node", "server.js"]
