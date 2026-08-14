# CalendarFly 🪔

**AI-powered event management and multilingual community broadcasting for temples and cultural organizations.**

Live app: [calendarflyapp.com](https://calendarflyapp.com) · Admin: [calendarflyapp.com/admin](https://calendarflyapp.com/admin)

Built for and running in production at **Sri Venkateswara Swamy Temple of Colorado**.

---

## The Problem

Temples, gurdwaras, and cultural community organizations run their event calendars the same way they did 20 years ago: a volunteer manually posts flyers, forwards WhatsApp messages one group at a time, and tracks RSVPs in a spreadsheet or not at all. There's no single source of truth for "what's happening this month," no automated multi-channel broadcast, and no way for a devotee to just *ask* — in their own language — what's coming up. Off-the-shelf tools like Eventbrite or Mailchimp aren't built for this audience: they don't understand a Hindu panchang, they're not WhatsApp-first (the primary channel for diaspora communities), and they assume paid marketing budgets small nonprofits don't have.

## The Solution

CalendarFly is a lightweight SaaS platform purpose-built for community/religious organizations:

- A public event calendar (with Panchang tithi/nakshatra badges) that's always the live source of truth, with local-storage fallback so it stays usable even if the API is briefly unavailable
- An **AI chatbot** that answers "what's happening this weekend?" using retrieval over the live event calendar — grounded in real data, not a static FAQ
- One-click **WhatsApp broadcast** to the whole community (Facebook and Instagram broadcast UI is scaffolded, API integration in progress)
- Automated, on-brand **flyer generation** for every event
- **RSVP analytics** so organizers know what's working
- Installable as a **Progressive Web App** for a native-app feel on mobile
- A built-in **multi-tenant signup flow** with tiered pricing (Free / Starter / Pro / Enterprise), so other organizations can self-serve onboard

## Target Users

Volunteer-run temples, gurdwaras, churches, and cultural associations — organizations with real events and real community demand, but no dedicated IT staff or marketing budget.

---

## How It Works

```mermaid
graph TD
    A[Admin Panel - React/Vite] -->|create/edit event| B[Express API]
    B --> C[(DynamoDB<br/>temple-events)]
    B --> D[(DynamoDB<br/>temple-panchang)]
    C --> E[Public Calendar - React/Vite SPA]
    C --> F[AI Chatbot Widget]
    F -->|live event context| G[Lambda + API Gateway<br/>us-east-1]
    G --> H[AWS Bedrock RAG]
    H --> I[(FAISS Vector Store)]
    B --> J[Broadcast Studio]
    J --> K[WhatsApp Business API]
    J --> L[Facebook Graph API]
    J --> M[Instagram Graph API]
    B --> N[canvasBuilder.js<br/>Flyer Generator]
    N --> O[(S3 - svtemple-flyers-co)]
    B --> Q[/api/organizations<br/>Multi-tenant signup]

    style A fill:#E67E22,color:#fff
    style E fill:#7A2048,color:#fff
    style F fill:#C9A227,color:#000
    style H fill:#C9A227,color:#000
```

**Data flow, plainly:** an admin creates an event in the panel → it's written to DynamoDB (`temple-events`), the single source of truth → the public calendar, the AI chatbot, and the broadcast tools all read from that same table, so there's never a stale flyer or an out-of-sync WhatsApp blast. The chatbot's Lambda function (in a separate AWS account, `us-east-1`) pulls live events through a `/api/events/upcoming` endpoint and injects them into a Bedrock RAG prompt, so answers are always grounded in what's actually on the calendar — not a stale training snapshot.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (SPA) |
| Backend | Express.js (Node) |
| Hosting | AWS App Runner (containerized via Docker/ECR) |
| Database | AWS DynamoDB (`temple-events`, `temple-panchang`) |
| AI / RAG | AWS Bedrock + FAISS vector search, served via AWS Lambda + API Gateway |
| Storage | AWS S3 (`svtemple-flyers-co`) |
| Messaging | WhatsApp broadcast (live) via `wa.me` deep links; Facebook/Instagram broadcast UI built, API integration in progress |
| Multi-tenancy | Organization signup, settings, and plan management via `/api/organizations/*` |
| PWA | `vite-plugin-pwa` + web manifest, installable on mobile |
| Infra-as-code | Cross-account IAM (`calendarfly-sync`) linking the app account to the AI/chatbot account |

## AI Capabilities

- **Retrieval-Augmented Generation (RAG) chatbot** — answers community questions grounded in the live event calendar rather than static training data, via AWS Bedrock + FAISS.
- **Live-context injection** — a Lambda function fetches upcoming events (`/api/events/upcoming`) on every query so the chatbot never recommends an event that's already passed or missing a new one.
- The web chatbot widget calls `/api/chat/temple-bot`, a backend proxy that injects this live event context into the model prompt before generating a response.

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- Docker
- AWS account with App Runner, ECR, DynamoDB, S3, and Lambda access
- Meta developer app with WhatsApp Business API access (for broadcasting)
- Google Cloud project with Translate API enabled

### Local development

```bash
git clone https://github.com/Jayasudhaa/CalendarFlyer.git
cd CalendarFlyer

# Frontend
cd temple-calendar
npm install
npm run dev

# Backend
cd ../server
npm install
npm run dev
```

### Environment variables

Copy `.env.example` to `.env` in the `temple-calendar/` folder and fill in real values — never commit `.env` itself:

```
VITE_ADMIN_USERNAME=
VITE_ADMIN_PASSWORD=
VITE_ADMIN_SECRET=
VITE_API_URL=
VITE_APP_URL=
```

Copy `server/.env.example` to `server/.env` and fill in real values for the backend (session/admin secrets, AWS region, WhatsApp/Facebook/Instagram tokens, and third-party API keys).

### Security note

This repo uses environment variables for all credentials (`.env.example` shows what's needed). No admin username, password, or secret is hardcoded anywhere in the source — set real values in your own `.env`, which is git-ignored and never committed.

### Deploying to production

```bash
# 1. Build the frontend
cd temple-calendar && npm run build

# 2. Copy the build into the server's static folder
xcopy dist ..\server\dist-frontend /E /I /Y

# 3. Build the Docker image
cd ../server
docker build -t temple-calendar .

# 4. Tag and push to ECR
docker tag temple-calendar:latest 011820201589.dkr.ecr.us-east-2.amazonaws.com/temple-calendar:latest
docker push 011820201589.dkr.ecr.us-east-2.amazonaws.com/temple-calendar:latest

# 5. Deploy — trigger a new deployment on the App Runner service "calendarfly"
```

---

## Project Status / MVP Scope

**Implemented:**
- ✅ Public calendar, live, with Panchang badges and local-storage fallback
- ✅ AI chatbot fully wired — answers questions grounded in live events via `/api/chat/temple-bot`
- ✅ WhatsApp broadcast, live and functional (`wa.me` deep links, no API token required)
- ✅ RSVP analytics (monthly view, stable event keys)
- ✅ DynamoDB as single source of truth across calendar, chatbot, and broadcast
- ✅ Premium flyer generator (`canvasBuilder.js`)
- ✅ Progressive Web App — installable via `vite-plugin-pwa` + manifest
- ✅ Multi-tenant signup flow with tiered pricing UI (Free / Starter / Pro / Enterprise)

**In progress / next up:**
- Facebook + Instagram broadcast API integration (UI is built, sending is not yet wired)
- Verifying and hardening the multi-tenant backend (`/api/organizations/*`) at scale
- Organization-level custom theming
- Multilingual event listings
- Mobile responsiveness polish across the admin panel

## Future Roadmap

- Full Facebook and Instagram broadcast automation
- Harden multi-tenant backend so any temple, gurdwara, or cultural association can self-serve onboard with confidence
- Organization-level custom theming and branding
- Multilingual event listings
- Continued mobile polish across admin surfaces

---

## License

TBD

## Contact

Built and maintained for Sri Venkateswara Swamy Temple of Colorado.
