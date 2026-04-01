# 🔐 Keystone

> Self-hosted server governance & credential management platform for on-prem environments without Active Directory.

Keystone is a self-hosted web platform that gives IT teams a single dashboard to manage server credentials, user access, and compliance — without needing Active Directory or expensive enterprise PAM tools.

---

## ✨ Current Features

### 🔑 Credential Management
- Remote VM password reset via WinRM/PowerShell
- Password history tracking (prevents last 5 reuse)
- Password expiry monitoring with email + in-app alerts
- Configurable password strength validation

### 🛡️ Security
- JWT authentication with token blacklisting
- bcrypt password hashing (12 rounds)
- Fernet (AES-128-CBC) encryption for stored VM credentials
- Custom rate limiting per endpoint
- Brute force detection (5 fails → admin alert)
- Math CAPTCHA (offline, SVG-based)

### 👥 Access Control
- Role-Based Access Control (user / admin / superadmin)
- User-VM mapping with admin-controlled assignments
- Full audit logging (user, IP, user-agent, timestamp)

### 📊 Operations
- VM health checks (background + on-demand)
- Admin dashboard with aggregated stats
- In-app notification system
- Email alerts (SMTP with HTML templates)

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 5, Tailwind CSS 3 |
| **Backend** | FastAPI, Uvicorn, Python |
| **Database** | MongoDB (Motor async driver) |
| **Scripts** | PowerShell (WinRM remoting) |
| **Scheduler** | APScheduler (background jobs) |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB 6+
- Windows Server (for WinRM connectivity to managed VMs)

### Backend Setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
# Configure .env (see .env.example)
python run.py
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 📋 Roadmap

- [ ] Linux server support (SSH)
- [ ] Credential vault (shared password manager)
- [ ] Just-In-Time (JIT) temporary access
- [ ] Server inventory dashboard
- [ ] MFA / TOTP for portal access
- [ ] Security posture scoring
- [ ] Secret rotation automation
- [ ] Multi-tenancy (MSP support)
- [ ] API access + webhooks

---


## 📄 License

Proprietary. All rights reserved.
