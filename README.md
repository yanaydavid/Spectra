# Spectra

RF chain calculator and datasheet reader for RF/microwave engineers.

Upload a component datasheet PDF → extract Gain, NF, IIP3, P1dB automatically → build an interactive RF chain → get real-time Friis cascade results.

## Stack

- **Frontend:** React + TypeScript, Vite, React Flow, Zustand, Tailwind CSS
- **Backend:** Python, FastAPI
- **AI:** Anthropic Claude API (datasheet extraction)

## Quick Start

```bash
# Backend
cd backend
cp .env.example .env  # add your ANTHROPIC_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

Or with Docker:
```bash
docker-compose up
```

## Documentation

- [PRD.md](./PRD.md) — Product requirements
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Technical architecture and formulas
- [TASKS.md](./TASKS.md) — Development task list

## Phase Roadmap

- **Phase 1 (MVP):** Chain calculator + datasheet reader ← current
- **Phase 2:** Auto-schematic generation
- **Phase 3:** PCB layout assistance
