# Contributing to Thryv PM Tool — Backend

## 📁 Project Structure

```
d:\pm-tool\
├── thryv-pmtool-backend/   # NestJS + Prisma API
└── thryv-pmtool-frontend/  # Frontend app (Next.js)
```

---

## 🌿 Branching Strategy

We follow a structured Git Flow:

```
main
 └── development
      └── feature/<task-name>
      └── fix/<bug-description>
      └── hotfix/<issue>
```

| Branch | Purpose |
|---|---|
| `main` | Production-ready code only. Never commit directly. |
| `development` | Integration branch. All features merge here first. |
| `feature/<name>` | One branch per sprint task. Branch off `development`. |
| `fix/<name>` | Bug fixes. Branch off `development`. |
| `hotfix/<name>` | Critical prod fixes. Branch off `main`. |

### Creating a Feature Branch
```bash
git checkout development
git pull origin development
git checkout -b feature/your-task-name
```

---

## ✍️ Commit Message Format

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <short description>
```

| Type | When to use |
|---|---|
| `feat` | New feature or endpoint |
| `fix` | Bug fix |
| `refactor` | Code restructure (no behavior change) |
| `docs` | Documentation updates |
| `chore` | Config, dependencies, tooling |
| `test` | Adding or updating tests |

**Examples:**
```
feat: implement JWT auth endpoint
fix: resolve token expiry validation bug
refactor: migrate schema to lookup tables
docs: update CONTRIBUTING with branching rules
```

---

## 🔁 Pull Request Rules

1. **Always PR into `development`**, never directly into `main`
2. PR title must follow commit format (e.g. `feat: implement auth API`)
3. At least **1 reviewer approval** required before merge
4. All CI checks must pass before merge
5. Delete the feature branch after merging

---

## 🛠️ Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Fill in your DATABASE_URL, JWT_SECRET

# 3. Run database migrations
npx prisma migrate dev

# 4. Seed the database
npm run db:seed

# 5. Start dev server
npm run dev
```

---

## 🗄️ Database Conventions

- All table/column names use **snake_case**
- IDs use `Int` with `autoincrement()`
- Lookup values (roles, statuses, types) live in **separate tables**, not enums
- Always run `npx prisma migrate dev --name <description>` after schema changes

---

## 📦 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run production build |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database with initial data |
