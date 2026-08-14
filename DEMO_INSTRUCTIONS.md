# CalendarFly — Demo / Judge Walkthrough

Live app: **https://calendarflyapp.com**
Admin panel: **https://calendarflyapp.com/admin**

Judge login credentials: *(provided separately in the submission form / on request)*

## 5-minute walkthrough

### 1. Public calendar — `/calendar`
- View the monthly calendar with tithi/nakshatra (panchang) shown per day
- Click the filter tabs (**All Events, Festival, Pooja, Abhishekam, Kalyanam, Panchangam**) — each shows only that category
- Open the chat widget (bottom-right) and ask **"What events are happening this week?"** — the answer is grounded in the real events currently on the calendar, not generic text

### 2. Admin panel — `/admin`
- Log in with the judge credentials
- Switch between the **Monthly Events** and **Monthly Panchang** tabs above the calendar grid
- Click any event — a shared toolbar appears with **+GCal / Edit / Flyer / Del** for that event
- Click the **+** next to any empty date to add a new event, pre-filled with that date

### 3. AI Flyer Studio — `/admin#flyer-studio`
- Open the Flyer Studio from the top toolbar
- Pick a deity/festival from the **Deity / Festival** dropdown (e.g. "Varalakshmi Vratam") — the prompt auto-fills
- Click **Generate Deity Image** to see the AI-generated artwork appear on the canvas
- Switch the language tab to **Kannada** (or Tamil/Telugu/Hindi) to see the flyer text translate in place

### 4. Broadcast Studio — `/admin#broadcast`
- Select an event, review the auto-filled WhatsApp caption
- (WhatsApp is fully wired; Facebook/Instagram show "Setup needed" pending Meta app credentials — see Roadmap)

### 5. Admin AI Assistant
- Open the "Temple Assistant" chat bubble inside the admin panel
- Type a request like **"open analytics"** — the assistant navigates you there directly, rather than just replying with text

## What to look for

- The chatbot's answers change when the underlying calendar data changes — it isn't a canned response
- The flyer image genuinely differs by deity/festival selected, not a single generic template
- The whole flow — create event → calendar updates → chatbot knows about it → flyer generates → broadcast sends — runs from one single event record (see `ARCHITECTURE.md`)
