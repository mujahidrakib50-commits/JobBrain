# JobBrain — Autonomous Job Application Submitter

JobBrain is an automated job application submission platform with an AI Brain. You paste job links, and JobBrain handles the application process using **only** the data you explicitly supply in your Profile.

## Core Mandates & Behavior
- **Zero AI Bluffing**: The app is strictly forbidden from guessing, inventing, or bluffing any personal information.
- **Strict Profile Data**: Only values saved in your Profile are ever submitted.
- **Waiting Tab Interventions**: If any question on a job application has no answer in your profile, the job automatically halts and waits in the **Waiting** tab with the questions translated into clear English.
- **Permanent Profile Memory**: Every answer you provide in the Waiting tab is automatically saved permanently into your Profile for future jobs.
- **Empty-Box Profile Search**: Clicking "Restart" on a waiting job with blank boxes triggers a semantic search against your existing profile data. If found, it automatically resolves and jumps to the **front of the Applying queue**.
- **Serial Concurrency**: Submits strictly **1 job at a time**.
- **Start / Stop Queue Control**: A global server-side toggle keeps the queue running in the background even if you close the browser.
- **Multi-language Support**: Job sites in French, Italian, German, etc. are processed natively while displaying clean English in your dashboard.

---

## Quick Start (Local)

### 1. Install dependencies
```bash
npm install
```

### 2. Prepare database & browsers
```bash
npx prisma db push
npx playwright install chromium
```

### 3. Run development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running with Docker (Self-Hosted)
```bash
docker compose up -d --build
```
This launches the app on `http://localhost:3000` with containerized Playwright Chromium, SQLite persistence, and uploaded file volumes.

---

## Configuration

### Settings → Profile
- **Profile Picture**: Upload your candidate photo in the circled view.
- **Questions & Answers**: Click **Add Data** to set up common job application fields:
  - Examples: `First Name`, `Last Name`, `Email`, `Phone Number`, `Date of Birth`, `Expected Monthly Salary`, `Do you have a driver's license?`, `Years of Experience`.
- **Attachments**: Click **Attach File** to upload your resume/CV (`CV / Resume`) or Cover Letter (`Cover Letter`).
- **Permanent Deletion**: Click the trash icon to permanently remove any field or file.

### Settings → Brain (API Keys)
- Click **Add New Key** to configure an AI provider:
  - **OpenAI**: `gpt-4o`, `gpt-4o-mini`
  - **Anthropic**: `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`
  - **Google Gemini**: `gemini-2.0-flash`, `gemini-1.5-pro`
  - **OpenRouter**: All models supported
- Use **Test Connection** to verify your key before saving.
- Click **Switch to this** on any saved key to switch the active brain instantly.

---

## Workflow Guide
1. Paste 1 or multiple job posting URLs (one per line) in the input box.
2. Click **Submit Links**.
3. Links appear in the **Applying** tab in FIFO order.
4. Drag or use the up/down arrows to reorder tasks in the queue.
5. Click **Start Submitting** in the top bar to start the serial processor.
6. If all questions are answered, the job is submitted and moves to **Applied** with the exact completion timestamp.
7. If any question is missing or a CAPTCHA is detected, the job moves to **Waiting** for your review.
