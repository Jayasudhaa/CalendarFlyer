# CalendarFly — Setup Instructions

CalendarFly is a full-stack app: a React frontend (`temple-calendar/`) and a Node/Express backend (`server/`).

## Prerequisites

- Node.js 18+ and npm
- An AWS account (DynamoDB, App Runner, ECR) for production deploy — not required for local dev
- An [Anthropic API key](https://console.anthropic.com) (for the AI chatbot)
- An [OpenAI API key](https://platform.openai.com) (for AI flyer image generation)
- Docker (only needed for the production build/deploy path)

## 1. Clone and install

```bash
git clone https://github.com/Jayasudhaa/CalendarFlyer.git
cd CalendarFlyer

cd temple-calendar
npm install

cd ../server
npm install
```

## 2. Configure environment variables

Copy the example file and fill in real values:

```bash
cp server/.env.example server/.env
```

At minimum, to run the app locally, set:

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (defaults to 5000) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Admin panel login |
| `SESSION_SECRET` / `JWT_SECRET` | Auth session signing — use any long random string |
| `ANTHROPIC_API_KEY` | Powers the AI chatbot (`server/routes/chat.js`) |
| `OPENAI_API_KEY` | Powers AI flyer image generation |
| `AWS_REGION`, `RSVP_TABLE`, `DYNAMO_EVENTS_TABLE`, `DYNAMO_PANCHANG_TABLE` | Only needed if connecting to real DynamoDB tables — otherwise the app falls back to local sample data |

The frontend also reads a few `VITE_*` variables at build time (`temple-calendar/.env` — not committed):

```
VITE_ADMIN_USERNAME=
VITE_ADMIN_PASSWORD=
VITE_ADMIN_SECRET=
```

**Never commit `.env` files** — both `temple-calendar/.env` and `server/.env` are git-ignored.

## 3. Run locally

Two terminals:

```bash
# Terminal 1 — backend
cd server
npm run dev
```

```bash
# Terminal 2 — frontend
cd temple-calendar
npm run dev
```

The frontend dev server (Vite) proxies `/api/*` requests to the backend — check `temple-calendar/vite.config.js` if the ports don't match what the backend logs on startup.

Open the URL Vite prints (usually `http://localhost:5173`):
- `/admin` — admin panel (log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `server/.env`)
- `/calendar` — public calendar + AI chatbot widget

## 4. Testing / Judge walkthrough

See [`DEMO_INSTRUCTIONS.md`](./DEMO_INSTRUCTIONS.md) for a step-by-step walkthrough of what to click once the app is running (or via the hosted link).

## 5. Production build & deploy

```bash
# Build the frontend
cd temple-calendar
npm run build

# Copy the build into the backend's static folder
cd ..
xcopy /E /I /Y temple-calendar\dist server\dist-frontend   # Windows
# cp -r temple-calendar/dist server/dist-frontend           # macOS/Linux

# Build and push the Docker image
cd server
docker build -t temple-calendar .
docker tag temple-calendar <your-ecr-repo>:latest
docker push <your-ecr-repo>:latest
```

Then deploy the new image through your hosting provider (this project deploys to AWS App Runner). Set every variable from `server/.env.example` as an environment variable on the hosting service — not just locally.
