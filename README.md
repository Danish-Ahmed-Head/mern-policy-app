# PolicyBot — HR Policy Assistant (MERN + AI)

An intelligent HR Policy chatbot system that allows employees to query company policies based on their role and experience level. Built with React, Node.js, Python (LangChain + LLaMA), and MongoDB.

---

## What Does It Do?

- Employees log in and ask questions like *"What is my health insurance coverage?"* or *"How many vacation days do I get?"*
- The AI reads only the policies that apply to **their specific role and experience**, and answers in plain English
- Admins can upload, update, and manage policy documents through a dashboard
- All conversations are saved so HR can review chat history

---

## System Architecture

```
React Frontend (port 3000)
        │
        ▼
Node.js / Express API (port 5000)   ←── Auth, Policy CRUD, Chat history
        │
        ▼
Python FastAPI (port 8000)          ←── AI chatbot (LangChain + LLaMA + FAISS)
        │
        ▼
MongoDB (port 27017)                ←── Users, Policies, Chat history
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 | UI framework |
| Material UI (MUI v5) | Component library |
| React Router v6 | Page navigation |
| Axios | HTTP requests |

### Backend (Node.js)
| Technology | Purpose |
|---|---|
| Express 5 | REST API server |
| Mongoose | MongoDB connection |
| JWT | Authentication tokens |
| Nodemailer | Forgot password emails |
| bcryptjs | Password hashing |

### AI Engine (Python)
| Technology | Purpose |
|---|---|
| FastAPI | Python API server |
| LangChain | AI orchestration |
| LlamaCpp | Run LLaMA model locally (no API key needed) |
| FAISS | Vector search for policy retrieval |
| HuggingFace Embeddings | Convert text to vectors (all-MiniLM-L12-v2) |
| PyMongo | MongoDB connection |
| Loguru | Logging |

### Database
| Technology | Purpose |
|---|---|
| MongoDB | Users, policies, chat history |

---

## Project Structure

```
mern-policy-app/
├── frontend/                    # React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.js         # Login + forgot password screen
│   │   │   ├── SplashScreen.js  # Loading screen
│   │   │   ├── AdminDashboard.js  # Admin: manage policies
│   │   │   └── EmployeeDashboard.js  # Employee: chat with bot
│   │   └── App.js               # Routes
│   └── package.json
│
├── backend/                     # Node.js API + Python AI
│   ├── routes/
│   │   ├── auth.js              # Login, forgot password, JWT
│   │   ├── policy.js            # Policy CRUD (admin only)
│   │   └── chat.js              # Chat history routes
│   ├── models/
│   │   └── User.js              # User schema
│   ├── python/
│   │   ├── api.py               # FastAPI server (AI endpoint)
│   │   ├── chatbot.py           # LangChain + LLaMA + FAISS logic
│   │   └── requirements.txt     # Python dependencies
│   ├── server.js                # Main Express server
│   └── .env                     # Environment variables (not committed)
```

---

## Prerequisites

### For Everyone
- [Node.js](https://nodejs.org/) v18 or later
- [MongoDB](https://www.mongodb.com/try/download/community) (running locally on port 27017)
- [Python](https://www.python.org/downloads/) 3.10 or later

### AI Model (Required for Chatbot)
Download the LLaMA model file and place it anywhere on your machine:
- **Model**: `Phi-3-mini-4k-instruct-v0.3-Q4_K_M.gguf`
- Download from: [HuggingFace — Phi-3-mini](https://huggingface.co/microsoft/Phi-3-mini-4k-instruct-gguf)
- Set the path in your `.env` file (see setup below)

---

## Setup & Installation

### Step 1 — Clone the repository
```bash
git clone https://github.com/MUHAMMADUSAMA64874/mern-policy-app.git
cd mern-policy-app
```

### Step 2 — Set up environment variables
Create a file called `.env` inside the `backend/` folder:
```env
MONGO_URI=mongodb://localhost:27017/policyDB
JWT_SECRET=your_secret_key_here
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
MODEL_PATH=C:/path/to/Phi-3-mini-4k-instruct-v0.3-Q4_K_M.gguf
```

> **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App Passwords → Generate one for "Mail"

### Step 3 — Install Node.js dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 4 — Set up Python environment

```bash
cd backend/python
python -m venv venv

# Windows
venv\Scripts\activate

# Mac/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### Step 5 — Start MongoDB
Make sure MongoDB is running:
```bash
# Windows (if installed as service)
net start MongoDB

# Or run manually
mongod
```

---

## Running the Application

You need **3 terminals** running simultaneously:

### Terminal 1 — Python AI Server
```bash
cd backend/python
venv\Scripts\activate     # Windows
python api.py
# Runs on http://localhost:8000
```

### Terminal 2 — Node.js Backend
```bash
cd backend
node server.js
# Runs on http://localhost:5000
```

### Terminal 3 — React Frontend
```bash
cd frontend
npm start
# Opens http://localhost:3000
```

Then open your browser at **http://localhost:3000**

---

## User Roles

### Employee
- Log in with username and password
- Ask questions about policies that apply to their role
- View their past chat history
- Request password reset via "Forgot Password" form

### Admin
- Log in with an admin account
- View, upload, update, and delete policy collections
- Download policies as JSON
- View all policy categories

---

## MongoDB Collections

The system uses a database called `policyDB` with these collections:

| Collection | Contents |
|---|---|
| `users` | User accounts (username, password, role, positionId, experience) |
| `promptHistory` | All chat conversations |
| `forgotRequests` | Password reset requests |
| `health_policies` | Health insurance policies |
| Any other `*_policies` | Additional policy types (auto-detected by the bot) |

### Sample User Document
```json
{
  "username": "john_doe",
  "password": "password123",
  "role": "Employee",
  "position": "Software Engineer",
  "positionId": "EMP01",
  "experience": "3"
}
```

### Sample Policy Document
```json
{
  "policyName": "Health Insurance",
  "status": "Active",
  "positionId": ["EMP01", "EMP02"],
  "ExperienceRange": "0-5",
  "coverage": "Full family coverage up to $50,000/year",
  "details": "..."
}
```

---

## API Endpoints

### Auth (Node.js — port 5000)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login and get JWT token |
| POST | `/api/auth/forgot` | Submit forgot password request |

### Policy (Node.js — port 5000, requires auth)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/policy/collections` | List all policy collections |
| GET | `/api/policy/collection/:id` | Get all records in a collection |
| POST | `/api/policy/collection/:id` | Create or update a collection |
| GET | `/api/policy/download/:id` | Download collection as JSON |
| POST | `/api/policy/collection/:id/record` | Add single record |
| PUT | `/api/policy/collection/:id/:recordId` | Update single record |
| DELETE | `/api/policy/collection/:id/:recordId` | Delete single record |

### Chat (Node.js — port 5000)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/chat/history` | Get chat history for a user |
| POST | `/api/chat/save` | Save a conversation |
| DELETE | `/api/chat/delete` | Delete a conversation |

### AI Chatbot (Python FastAPI — port 8000)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login (Python version) |
| POST | `/chat` | Initialize chat session |
| POST | `/ask` | Ask a policy question |
| GET | `/health` | Health check |

---

## How the AI Works (Simple Explanation)

1. When a user logs in, the system knows their **Position ID** and **years of experience**
2. It loads only the policies that apply to that specific person from MongoDB
3. Those policies are converted into **vectors** (numbers that represent meaning) using a HuggingFace model
4. When a question is asked, FAISS finds the most relevant policy chunks using **semantic search**
5. The LLaMA model reads those chunks and generates a human-readable answer
6. Responses are cached so repeated questions are answered instantly

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `MongoDB connection error` | Make sure MongoDB is running: `net start MongoDB` |
| `Model file does not exist` | Check `MODEL_PATH` in `.env` points to the `.gguf` file |
| `Port 8000 already in use` | Kill the process: `netstat -ano \| findstr :8000` then `taskkill /PID <pid> /F` |
| `CORS error` | Make sure all 3 servers are running on their correct ports |
| Frontend shows blank page | Run `npm install` inside the `frontend/` folder |
| Python import errors | Make sure venv is activated and `pip install -r requirements.txt` was run |

---

## Developer Notes

- The JWT secret is currently stored as a string in `auth.js` — move it to `.env` before deploying
- Passwords are stored in plain text in MongoDB — add bcrypt hashing before production use
- The AI model runs entirely locally — no OpenAI API key or internet connection required for chat
- Policy collections are auto-discovered from MongoDB — just add a new collection ending in `_policies` and the bot will pick it up

---

## License

This project was built as a Final Year Project (FYP) at KIET. All rights reserved.
