# Ajaia submission — Folio

**Live app on Cloudflare Workers** — [Open Folio](https://ajaia-test.ilacosta05.workers.dev/)

**Walkthrough** — [Watch the video](https://youtu.be/8lEzuzBK7Yc?si=kRYVAjucJUwE25Y_)

Use the credentials in `DEMO-ACCOUNTS.md`. Sign in as Riley to create, import, and share a document. Open a second browser session as Morgan to try both Viewer and Editor access. The step-by-step review flow is in `README.md`.

## Folder contents

| Item | Location |
|---|---|
| Source code, Supabase migrations, lockfile, and Vitest test | `Folio-source.zip` |
| Local setup, review steps, and test command | `README.md` |
| Architecture and tradeoffs | `ARCHITECTURE.md` |
| AI tools, decisions, and verification | `AI-WORKFLOW.md` |
| Submission index and live product URL | `SUBMISSION.md` |
| Riley and Morgan demo credentials | `DEMO-ACCOUNTS.md` |
| Link to the walkthrough video | `WALKTHROUGH.txt` |

## Scope

Folio supports rich-text editing, explicit saves, plain-text imports, Viewer and Editor sharing, and owner-only deletion. Live co-editing and version history are outside this version. With another 2–4 hours, I would add per-recipient access removal and automated tests for the database permissions.
