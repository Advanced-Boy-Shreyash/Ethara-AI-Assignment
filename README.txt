# TaskFlow — Team Task Manager

A full-stack web app for teams to manage projects, assign tasks, and track progress through a Kanban board — all with role-based access control.

Built with **Django REST Framework** on the backend and **Next.js** on the frontend.

---

## Tech Stack

### Backend
- **Python 3.12+**
- **Django 6** — Web framework
- **Django REST Framework 3.17** — API layer
- **SimpleJWT** — Token-based authentication (access + refresh)
- **SQLite** — Database (ships with Django, zero config)
- **django-cors-headers** — Cross-origin requests

### Frontend
- **Next.js 16** (App Router) — React framework
- **React 19** — UI library
- **Axios** — HTTP client with JWT interceptors
- **Tailwind CSS v4** — Utility classes
- **Lucide React** — Icon library
- **Vanilla CSS** — Custom design system (dark theme)

---

## Database

SQLite — no external database setup required. The file gets created automatically at `backend/db.sqlite3` when you run migrations.

### Schema

The app uses four main tables:

```
┌──────────────────────┐       ┌──────────────────────┐
│        User          │       │       Project         │
├──────────────────────┤       ├──────────────────────┤
│ id (PK)              │       │ id (PK)              │
│ email (unique)       │       │ name                 │
│ name                 │       │ description          │
│ username             │       │ owner_id (FK → User) │
│ password (hashed)    │       │ created_at           │
│ date_joined          │       │ updated_at           │
└──────────┬───────────┘       └──────────┬───────────┘
           │                              │
           │  ┌───────────────────────┐   │
           └──│    ProjectMember      │───┘
              ├───────────────────────┤
              │ id (PK)              │
              │ user_id (FK → User)  │
              │ project_id (FK)      │
              │ role (ADMIN/MEMBER)  │
              │ joined_at            │
              └───────────────────────┘
                          │
              ┌───────────────────────┐
              │         Task          │
              ├───────────────────────┤
              │ id (PK)              │
              │ title                │
              │ description          │
              │ status (TODO /       │
              │   IN_PROGRESS /      │
              │   IN_REVIEW / DONE)  │
              │ priority (LOW /      │
              │   MEDIUM / HIGH)     │
              │ due_date             │
              │ project_id (FK)      │
              │ assignee_id (FK)     │
              │ creator_id (FK)      │
              │ created_at           │
              │ updated_at           │
              └───────────────────────┘
```

**Relationships:**
- A **User** can own many Projects, be a member of many Projects, and be assigned many Tasks.
- A **Project** has many Members (through ProjectMember) and many Tasks.
- A **ProjectMember** links a User to a Project with a role — either `ADMIN` or `MEMBER`.
- A **Task** belongs to one Project, can be assigned to one User, and is created by one User.

---

## Architecture Overview

```
frontend/ (Next.js)              backend/ (Django)
┌──────────────────┐            ┌──────────────────┐
│  Browser (3000)  │──Axios────▶│  Django API (8000)│
│                  │  + JWT     │                   │
│  App Router      │◀───JSON───│  DRF ViewSets     │
│  AuthContext     │            │  Permissions      │
│  Lucide Icons    │            │  SimpleJWT        │
│  Tailwind CSS    │            │  SQLite           │
└──────────────────┘            └──────────────────┘
```

**How it works:**

1. The frontend is a single-page app that runs on `localhost:3000`.
2. All data flows through REST API calls to the Django backend on `localhost:8000`.
3. Authentication uses JWT tokens — an `access` token (short-lived) and a `refresh` token (longer-lived). These are stored in `localStorage`.
4. Every API request attaches the access token via an Axios interceptor. If it expires, the interceptor silently refreshes it using the refresh token.
5. Role-based permissions are enforced on the backend using custom DRF permission classes. The frontend hides/shows UI elements based on role, but the backend is the real gatekeeper.

### Role-Based Access Control (RBAC)

| Action | Admin | Member |
|--------|-------|--------|
| Create project | ✅ | ✅ |
| Edit/delete project | ✅ | ❌ |
| Add/remove members | ✅ | ❌ |
| Change member roles | ✅ | ❌ |
| View project tasks | ✅ | ✅ |
| Create tasks | ✅ | ✅ |
| Move tasks (status change) | ✅ | ✅ |
| Edit own tasks | ✅ | ✅ |
| Edit any task | ✅ | ❌ |
| Delete tasks | ✅ | ❌ |

---

## REST API Endpoints

Base URL: `http://localhost:8000/api`

### Authentication (`/api/auth/`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|:---:|
| POST | `/auth/signup/` | Register a new user | No |
| POST | `/auth/login/` | Login, returns JWT tokens | No |
| POST | `/auth/refresh/` | Refresh an expired access token | No |
| GET | `/auth/me/` | Get current user info | Yes |
| GET | `/auth/users/search/?q=` | Search users by email | Yes |

**Signup body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword"
}
```

**Login response:**
```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "user": { "id": 1, "name": "John Doe", "email": "john@example.com" }
}
```

---

### Projects (`/api/projects/`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|:---:|
| GET | `/projects/` | List user's projects | Yes |
| POST | `/projects/` | Create a new project | Yes |
| GET | `/projects/:id/` | Get project details + members | Yes |
| PUT | `/projects/:id/` | Update project | Admin |
| DELETE | `/projects/:id/` | Delete project | Admin |
| POST | `/projects/:id/members/` | Add a member | Admin |
| PATCH | `/projects/:id/members/:userId/` | Change member role | Admin |
| DELETE | `/projects/:id/members/:userId/` | Remove a member | Admin |

**Create project body:**
```json
{
  "name": "Marketing Campaign",
  "description": "Q3 digital marketing planning"
}
```

**Add member body:**
```json
{
  "email": "jane@example.com",
  "role": "MEMBER"
}
```

---

### Tasks (`/api/tasks/`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|:---:|
| GET | `/tasks/projects/:projectId/tasks/` | List tasks in a project | Member |
| POST | `/tasks/projects/:projectId/tasks/` | Create a task | Member |
| GET | `/tasks/projects/:projectId/tasks/:id/` | Get task detail | Member |
| PUT | `/tasks/projects/:projectId/tasks/:id/` | Full update | Owner/Admin |
| PATCH | `/tasks/projects/:projectId/tasks/:id/` | Partial update (status) | Member |
| DELETE | `/tasks/projects/:projectId/tasks/:id/` | Delete a task | Admin |

**Query filters:** `?status=TODO`, `?priority=HIGH`, `?assignee=1`

**Create task body:**
```json
{
  "title": "Design landing page",
  "description": "Create wireframes and mockups",
  "priority": "HIGH",
  "status": "TODO",
  "due_date": "2026-06-01",
  "assignee_id": 2
}
```

---

### Dashboard (`/api/tasks/dashboard/`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tasks/dashboard/stats/` | Aggregated task counts (total, by status, overdue) |
| GET | `/tasks/dashboard/my-tasks/` | All tasks assigned to or created by the current user |

**Stats response:**
```json
{
  "total_tasks": 12,
  "todo": 3,
  "in_progress": 4,
  "in_review": 2,
  "done": 3,
  "overdue": 1,
  "total_projects": 3
}
```

---

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Email + password sign-in form |
| `/signup` | Signup | Registration with name, email, password |
| `/dashboard` | Dashboard | Stats cards, recent projects, Kanban board of user's tasks |
| `/dashboard/projects` | Projects | Grid view of all projects with search and create modal |
| `/dashboard/projects/:id` | Project Detail | 4-column Kanban board (To Do → In Progress → In Review → Done), task CRUD, member management |

### Key UI Features
- **Dark theme** with glassmorphism on auth pages
- **4-stage Kanban board** with forward/backward task movement
- **Custom confirmation modals** for delete and move-back actions
- **Role-based UI** — admin-only buttons are hidden for members
- **Lucide React icons** throughout the interface
- **Responsive layout** with collapsible sidebar on mobile

---

## Folder Structure

```
Ethara.ai/
├── backend/
│   ├── config/             # Django settings, root URLs
│   │   ├── settings.py
│   │   └── urls.py
│   ├── accounts/           # User model, auth views, JWT
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   ├── projects/           # Project + member management
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── permissions.py
│   │   └── urls.py
│   ├── tasks/              # Task CRUD, dashboard endpoints
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── permissions.py
│   │   └── urls.py
│   ├── requirements.txt
│   ├── manage.py
│   └── .env
│
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── globals.css         # Design system + Tailwind
    │   │   ├── layout.js           # Root layout with fonts
    │   │   ├── page.js             # Root redirect
    │   │   ├── login/page.js
    │   │   ├── signup/page.js
    │   │   └── dashboard/
    │   │       ├── layout.js       # Sidebar + auth guard
    │   │       ├── page.js         # Dashboard home
    │   │       └── projects/
    │   │           ├── page.js     # Project list
    │   │           └── [id]/page.js # Project detail + Kanban
    │   ├── context/
    │   │   └── AuthContext.js      # JWT auth state
    │   └── lib/
    │       ├── api.js              # Axios instance + interceptors
    │       └── utils.js            # Helpers (date, avatar, etc.)
    ├── package.json
    └── postcss.config.mjs
```

---

## How to Run

### Prerequisites
- Python 3.12+
- Node.js 20+
- npm

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
.\venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
echo "SECRET_KEY=your-secret-key-here" > .env
echo "DEBUG=True" >> .env
echo "CORS_ALLOWED_ORIGINS=http://localhost:3000" >> .env

# Run migrations
python manage.py migrate

# Start the server
python manage.py runserver
```

Backend runs at **http://localhost:8000**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Frontend runs at **http://localhost:3000**

### 3. You're good to go

Open `http://localhost:3000` in your browser. Sign up, create a project, add some tasks, and try the Kanban board.

---