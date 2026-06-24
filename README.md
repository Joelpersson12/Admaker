---
title: Reelix
emoji: 🎬
colorFrom: purple
colorTo: pink
sdk: docker
pinned: false
app_port: 7860
---

# Reelix — AI Ad Videos in Seconds

Turn any product into a scroll-stopping ad video using AI. Generate copy, compose visuals, and create real AI-generated video ads — no editing skills required.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python
- **AI Copy**: OpenAI GPT-4o
- **AI Video**: fal.ai (Kling text-to-video)

---

## Project Structure

```
reelix/
├── backend/
│   ├── __init__.py
│   ├── routes.py          # FastAPI routes
│   └── video_service.py   # fal.ai integration
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── steps/
│   │   │   │   ├── Step1ProductInfo.tsx
│   │   │   │   ├── Step2GenerateCopy.tsx
│   │   │   │   ├── Step3ComposeAd.tsx
│   │   │   │   └── Step4VideoGenerate.tsx
│   │   │   ├── AdCreator.tsx
│   │   │   ├── AnimatedReel.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Header.tsx
│   │   │   └── LandingPage.tsx
│   │   ├── styles/index.css
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── main.py                # FastAPI entry point
├── requirements.txt
├── .env.example
└── .gitignore
```

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/Joelpersson12/Admaker.git
cd Admaker
```

### 2. Backend

```bash
# Create and activate virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\activate

# Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
OPENAI_API_KEY=sk-...       # Required for AI copy generation
FAL_KEY=...                  # Optional — enables real AI video (fal.ai)
FAL_VIDEO_MODEL=fal-ai/kling-video/v1.6/standard/text-to-video
```

> **Without `FAL_KEY`**: The app still works — it shows a CSS animated preview instead of a real video.

### 3. Frontend

```bash
cd frontend
npm install
npm run build
cd ..
```

### 4. Run the app

```bash
uvicorn main:app --reload --port 8000
```

Visit: [http://localhost:8000](http://localhost:8000)

---

## Development Mode (hot reload)

Run backend and frontend simultaneously:

**Terminal 1 — Backend:**
```bash
.venv\Scripts\activate      # (Windows)
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend dev server:**
```bash
cd frontend
npm run dev
```

Frontend dev server runs on [http://localhost:5174](http://localhost:5174) and proxies `/api` calls to the backend.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/config` | Returns `{ copy_enabled, video_enabled }` |
| `POST` | `/api/generate-copy` | Generate ad copy with GPT-4o |
| `POST` | `/api/generate-video` | Submit fal.ai video generation job |
| `GET` | `/api/video-status` | Poll job status / get video URL |

---

## How It Works

1. **Product Info** — Enter your product name, description, target audience, tone, and platform
2. **AI Script** — GPT-4o generates 3 options each for headlines, subheadlines, and CTAs. Pick your favorites
3. **Compose Visual** — Choose a template (Dark Bold / Vibrant / Clean), colors, and format (Story/Square/Landscape). Preview updates live
4. **Generate Video** — Submit to fal.ai Kling model for real AI video, or get a CSS animated preview if no FAL_KEY is set

---

## Getting a fal.ai Key

1. Go to [fal.ai](https://fal.ai) and create an account
2. Navigate to API Keys in your dashboard
3. Create a new key and add it to `.env` as `FAL_KEY`

Kling video generation costs approximately $0.05–0.10 per video.

---

## License

MIT
