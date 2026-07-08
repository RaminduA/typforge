# Typforge

Typforge is a Prism-style online Typst workspace.

MVP scope:

- Create/open a Typst project
- Edit `.typ` files in the browser
- Maintain project folders/files
- Upload ZIP projects
- Compile Typst through Docker
- Preview the generated PDF
- Download the PDF
- Inspect Project Info, Versions, and Logs

## Stack

- Frontend: Next.js + TypeScript + Tailwind-free CSS
- Backend: Go + chi + REST
- Compiler: Typst Docker image
- MVP storage: local filesystem

## Requirements

- Node.js
- npm
- Go
- Docker Desktop

## Setup

Install frontend dependencies:

```bash
npm run web:install
```

Install backend dependencies:

```bash
npm run api:tidy
```

Pull Typst Docker image:

```bash
docker pull ghcr.io/typst/typst:latest
Run backend
npm run api:dev
```

Backend runs on:

```bash
http://localhost:8080/api/v1
Run frontend
```

Open another terminal:

```bash
npm run web:dev
```

Frontend runs on:

```bash
http://localhost:3000
API health check
curl http://localhost:8080/api/v1/health
```
