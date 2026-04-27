# Nagarkot OS — Satellite Application Developer Guide

**For any developer building an application that connects to Nagarkot OS.**

Nagarkot OS is the central identity, access-control, and data hub for the Nagarkot ecosystem. Any application ("satellite app") that plugs into this ecosystem — whether it's a training portal, a freight dashboard, an HR tool, or anything else — **does not manage its own user passwords or identity**. Instead, it delegates all authentication to OS and receives real-time data updates via webhooks.

This guide covers the two pillars of integration:
1. **Authentication (SSO & Direct Login)** — How users get into your app.
2. **Webhooks** — How your app stays in sync with OS.

---

## Table of Contents
- [Part 1: Architecture Overview](#part-1-architecture-overview)
- [Part 2: Environment Setup](#part-2-environment-setup)
- [Part 3: SSO Authentication (Primary Flow)](#part-3-sso-authentication-primary-flow)
- [Part 4: Direct Login (Fallback / Programmatic Flow)](#part-4-direct-login-fallback--programmatic-flow)
- [Part 5: Webhooks — Why & How](#part-5-webhooks--why--how)
- [Part 6: Database Schema Requirements](#part-6-database-schema-requirements)
- [Part 7: Checklist](#part-7-checklist)

---

## Part 1: Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                       NAGARKOT OS                            │
│                                                              │
│   ┌────────────┐    ┌────────────────┐   ┌───────────────┐   │
│   │   Users &   │    │  App Registry  │   │  Webhook      │   │
│   │  Passwords  │    │  & Access      │   │  Dispatcher   │   │
│   │  (bcrypt)   │    │  Control       │   │  (per-app)    │   │
│   └──────┬─────┘    └───────┬────────┘   └──────┬────────┘   │
│          │                  │                    │            │
│    ┌─────┴──────────────────┴──────┐             │            │
│    │         OS Backend API        │             │            │
│    │  /auth/login                  │             │            │
│    │  /auth/sso-token?app=slug     │─── RS256 ──►│            │
│    │  /auth/verify-password        │             │            │
│    │  /auth/verify-session         │             │            │
│    │  /auth/public-key             │             │            │
│    └───────────────────────────────┘             │            │
└──────────────────────────────────────────────────┼────────────┘
                                                   │
              ┌────────────────────────────────────┼──────────┐
              │                                    │          │
              ▼                                    ▼          ▼
   ┌──────────────────┐              ┌──────────────────────────┐
   │  YOUR SATELLITE  │              │  OTHER SATELLITE APPS    │
   │  APP BACKEND     │              │  (same pattern)          │
   │                  │              └──────────────────────────┘
   │  POST /auth/sso          ← browser redirect with token
   │  POST /webhooks/os       ← server-to-server push from OS
   │  GET  /users/me          ← your own session (HS256 cookie)
   └──────────────────┘
```

**Key principles:**
- OS **owns** all user identities, passwords, departments, and organizations.
- Your app **never** stores or verifies passwords.
- Your app maintains a **local read-only cache** of OS entities (users, departments).
- OS communicates with your app via two channels:
  - **SSO tokens** (user-initiated, browser redirect)
  - **Webhooks** (OS-initiated, server-to-server)

---

## Part 2: Environment Setup

Every satellite app needs these environment variables:

```env
# ── Required ─────────────────────────────────────────────────────

# The URL where OS backend is running
OS_BACKEND_URL=http://localhost:3001

# Shared secret between OS and your app (server-to-server trust)
# OS sends this in the x-internal-key header on webhooks
# Your app sends this back when calling OS internal APIs
INTERNAL_API_KEY=your-shared-secret-here

# The RS256 public key used by OS to sign SSO tokens
# Your app uses this to VERIFY the signature on incoming SSO tokens
# You can fetch this from GET {OS_BACKEND_URL}/auth/public-key
OS_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjAN...\n-----END PUBLIC KEY-----"

# ── Your app's own session config ────────────────────────────────

# Secret for signing YOUR app's local HS256 session tokens
SECRET_KEY=my-app-local-secret

# Cookie configuration
COOKIE_SECURE=false           # true in production (HTTPS only)
COOKIE_SAMESITE=lax           # 'lax' for same-site, 'none' for cross-site
```

> [!TIP]
> You can dynamically fetch the OS public key at startup by calling `GET {OS_BACKEND_URL}/auth/public-key`. This avoids copy-pasting keys manually. However, caching it as an env var is recommended for production performance.

---

## Part 3: SSO Authentication (Primary Flow)

This is how users log into your app via the OS portal.

### 3.1 The Full Flow (Step by Step)

```
  USER                   OS FRONTEND             OS BACKEND              YOUR FRONTEND           YOUR BACKEND
   │                         │                       │                        │                       │
   │  1. Clicks your app     │                       │                        │                       │
   │  icon on OS dashboard   │                       │                        │                       │
   │────────────────────────►│                       │                        │                       │
   │                         │                       │                        │                       │
   │                         │  2. GET /auth/sso-token?app=your-slug          │                       │
   │                         │──────────────────────►│                        │                       │
   │                         │                       │                        │                       │
   │                         │                       │  (OS verifies user has │                       │
   │                         │                       │   access to your app,  │                       │
   │                         │                       │   signs RS256 JWT,     │                       │
   │                         │                       │   stores token_id)     │                       │
   │                         │                       │                        │                       │
   │                         │  3. { sso_token: "eyJ..." }                    │                       │
   │                         │◄──────────────────────│                        │                       │
   │                         │                       │                        │                       │
   │  4. Browser redirect:   │                       │                        │                       │
   │  https://your-app/sso?token=eyJ...              │                        │                       │
   │◄────────────────────────┼───────────────────────┼───────────────────────►│                       │
   │                         │                       │                        │                       │
   │                         │                       │                        │  5. POST /auth/sso     │
   │                         │                       │                        │     { token: "eyJ..." }│
   │                         │                       │                        │─────────────────────► │
   │                         │                       │                        │                       │
   │                         │                       │                        │  (Your backend:        │
   │                         │                       │                        │   - Verifies RS256     │
   │                         │                       │                        │   - Checks replay      │
   │                         │                       │                        │   - JIT provisions     │
   │                         │                       │                        │   - Issues HS256       │
   │                         │                       │                        │     session cookie)    │
   │                         │                       │                        │                       │
   │                         │                       │                        │  6. Set-Cookie +       │
   │                         │                       │                        │     { user: {...} }    │
   │  7. User is now logged  │                       │                        │◄─────────────────────  │
   │     into YOUR app       │                       │                        │                       │
   │◄────────────────────────┼───────────────────────┼────────────────────────│                       │
```

### 3.2 What OS Puts Inside the SSO Token

When OS generates the SSO token, it signs a JWT with these exact fields:

```typescript
interface SsoPayload {
  // Identity — OS owns these
  token_id: string;       // UUID — unique per token, used for replay prevention
  user_id: string;        // The user's ID in OS (your app stores this as os_user_id)
  email: string;
  name: string;
  user_type: 'employee' | 'client';

  // Department — OS owns, apps sync on every login
  department_slug: string | null;   // null for client users
  department_name: string | null;

  // App permission — OS decides, apps respect
  is_app_admin: boolean;            // true = this user is a super admin for YOUR app
  is_team_lead?: boolean;           // true = department lead

  // Client org — OS owns, apps filter data by this
  org_id: string | null;
  org_name: string | null;

  // Standard JWT fields (auto-set)
  iat: number;            // issued at (unix timestamp)
  exp: number;            // expires at (60 seconds after issuance!)
}
```

> [!WARNING]
> **The token expires in 60 seconds.** It is a one-time-use redirect token, NOT a session token. Your app must consume it immediately and issue its own long-lived session.

### 3.3 Frontend: The SSO Landing Page

Your frontend needs a public route (e.g., `/sso`) that catches the redirect from OS, extracts the token from the URL, and sends it to YOUR backend.

**React example:**

```jsx
// pages/SsoPage.jsx
import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function SsoPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState('');
  const hasConsumed = useRef(false);  // Prevent double-fire in React StrictMode

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setError('No SSO token provided.'); return; }

    // Guard against React StrictMode double-mount
    if (hasConsumed.current) return;
    hasConsumed.current = true;

    async function consumeToken() {
      try {
        const res = await fetch(`${API_BASE}/auth/sso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',           // Required for httpOnly cookie
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.detail || 'SSO failed');
        }

        const data = await res.json();
        login(data.user);                   // Store user in React context
        window.history.replaceState({}, '', '/');  // Clean token from URL
        navigate('/', { replace: true });
      } catch (err) {
        setError(err.message || 'SSO login failed.');
      }
    }

    consumeToken();
  }, []);

  if (error) return <div className="error">{error}</div>;
  return <div>Signing you in...</div>;
}
```

**Router setup:** Make sure `/sso` is a public (unauthenticated) route:

```jsx
// App.jsx
<Route path="/sso" element={<SsoPage />} />
```

> [!IMPORTANT]
> **`credentials: 'include'`** is critical. Without it, the browser will not accept the `Set-Cookie` header from your backend, and the user's session will not persist.

### 3.4 Backend: The SSO Verification Endpoint

This is where the real security happens. Your backend must perform **6 steps** in order.

**Python / FastAPI example:**

```python
# sso.py — SSO Consumer endpoint

import os
from datetime import datetime
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import jwt, JWTError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db
from . import models
from .auth import create_access_token, set_auth_cookie

router = APIRouter()

# ── Config ────────────────────────────────────────────────────
OS_JWT_PUBLIC_KEY = os.getenv("OS_JWT_PUBLIC_KEY", "").replace("\\n", "\n")
OS_BACKEND_URL   = os.getenv("OS_BACKEND_URL", "http://localhost:3001")
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")


class SsoRequest(BaseModel):
    token: str


@router.post("/sso")
def sso_login(
    request: Request,
    body: SsoRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    # ── STEP 1: Verify RS256 Signature ────────────────────────
    # This proves the token was genuinely issued by OS
    # and has not been tampered with or expired.
    if not OS_JWT_PUBLIC_KEY:
        raise HTTPException(500, "SSO not configured — OS_JWT_PUBLIC_KEY is missing")

    try:
        payload = jwt.decode(
            body.token,
            OS_JWT_PUBLIC_KEY,
            algorithms=["RS256"],
        )
    except JWTError as e:
        raise HTTPException(401, f"Invalid or expired SSO token: {e}")


    # ── STEP 2: Extract Identity Fields ──────────────────────
    token_id        = payload.get("token_id")
    os_user_id      = payload.get("user_id")        # OS calls it user_id
    email           = payload.get("email")
    name            = payload.get("name")
    user_type       = payload.get("user_type")       # 'employee' or 'client'
    department_slug = payload.get("department_slug")
    department_name = payload.get("department_name")
    org_id          = payload.get("org_id")
    is_app_admin    = payload.get("is_app_admin", False)
    is_team_lead    = payload.get("is_team_lead", False)

    if not all([token_id, os_user_id, email]):
        raise HTTPException(401, "SSO token payload is incomplete")


    # ── STEP 3: Replay Attack Prevention ─────────────────────
    # The token travels via browser URL — it could be intercepted.
    # We must ensure each token_id is used EXACTLY ONCE.
    existing = db.query(models.SsoTokenLog).filter(
        models.SsoTokenLog.token_id == token_id
    ).first()

    if existing:
        raise HTTPException(401, "SSO token has already been used")

    try:
        db.add(models.SsoTokenLog(
            token_id=token_id,
            used=True,
            consumed_at=datetime.utcnow(),
            app_slug="your-app-slug",  # Replace with your app's slug
        ))
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(401, "SSO token has already been used")


    # ── STEP 4: Verify User is Still Active in OS ────────────
    # Edge case: user was deactivated AFTER the token was issued
    # but BEFORE it was consumed (within the 60s window).
    try:
        check = httpx.post(
            f"{OS_BACKEND_URL}/auth/verify-session",
            json={"os_user_id": os_user_id},
            headers={"x-internal-key": INTERNAL_API_KEY},
            timeout=5.0,
        )
        if check.status_code == 200:
            if not check.json().get("is_active", True):
                raise HTTPException(403, "Your account has been deactivated.")
        elif check.status_code == 404:
            raise HTTPException(403, "Your account was not found in OS.")
    except httpx.RequestError:
        # Network error — fail OPEN (allow login, log warning)
        print(f"WARNING: Could not reach OS to verify {os_user_id}")


    # ── STEP 5: Just-in-Time (JIT) User Provisioning ─────────
    # Find or create the user in YOUR database.
    # On every login, sync their identity fields from OS.
    user = db.query(models.User).filter(
        models.User.os_user_id == os_user_id
    ).first()

    if not user:
        # Fallback: match by email (for legacy users before SSO existed)
        user = db.query(models.User).filter(
            models.User.email == email
        ).first()

    # Resolve the correct local role
    role_name = resolve_role(is_app_admin, is_team_lead, user_type)
    role = db.query(models.Role).filter(models.Role.name == role_name).first()

    if user:
        # Sync cached fields from OS
        user.full_name       = name or user.full_name
        user.email           = email or user.email
        user.department_slug = department_slug
        user.org_id          = org_id
        user.is_app_admin    = is_app_admin
        if user.os_user_id is None:
            user.os_user_id = os_user_id
        if role:
            user.role_id = role.id
        db.commit()
    else:
        # First-time login — create user
        user = models.User(
            email=email,
            full_name=name or email,
            role_id=role.id if role else None,
            status="active",
            os_user_id=os_user_id,
            department_slug=department_slug,
            org_id=org_id,
            is_app_admin=is_app_admin,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if not user.is_active:
        raise HTTPException(403, "Your account has been deactivated")


    # ── STEP 6: Issue YOUR App's Session Token ───────────────
    # This is YOUR own HS256 JWT, completely separate from the OS token.
    # It gets stored as an httpOnly cookie.
    app_token = create_access_token(data={"sub": user.id})
    set_auth_cookie(response, app_token)

    return {
        "access_token": "",        # Cookie-based — no token in response body
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": {"name": user.role.name} if user.role else None,
            "is_app_admin": user.is_app_admin,
            "department_slug": user.department_slug,
            "org_id": user.org_id,
        },
    }


def resolve_role(is_app_admin: bool, is_team_lead: bool, user_type: str) -> str:
    """Maps OS permission flags to your app's internal role names."""
    if is_app_admin:
        return "ADMIN"
    if is_team_lead:
        return "TEAM LEAD"
    if user_type == "client":
        return "CLIENT"
    return "EMPLOYEE"
```

### 3.5 Backend: Local Session Helpers

These utilities power Step 6. They issue and read your app's own HS256 session tokens.

```python
# auth.py — Local session management (NO passwords here!)

import os
from datetime import datetime, timedelta
from typing import Optional
from fastapi import Cookie, Depends, Header, HTTPException, Response, status
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from .database import get_db
from . import models

SECRET_KEY           = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM            = "HS256"
TOKEN_EXPIRE_HOURS   = 24
COOKIE_NAME          = "nagarkot_token"
COOKIE_MAX_AGE       = TOKEN_EXPIRE_HOURS * 3600
COOKIE_SECURE        = os.getenv("COOKIE_SECURE", "false").lower() in {"1", "true"}
COOKIE_SAMESITE      = os.getenv("COOKIE_SAMESITE", "lax")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=TOKEN_EXPIRE_HOURS))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,          # Not accessible via JavaScript
        secure=COOKIE_SECURE,   # HTTPS only in production
        samesite=COOKIE_SAMESITE,
        max_age=COOKIE_MAX_AGE,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/",
                           secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)


def get_current_user(
    db: Session = Depends(get_db),
    nagarkot_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> models.User:
    """FastAPI dependency — extracts user from cookie or Authorization header."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Try cookie first, then Bearer header
    token = nagarkot_token
    if not token and authorization:
        scheme, _, param = authorization.partition(" ")
        if scheme.lower() == "bearer":
            token = param

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user
```

### 3.6 Cleanup: Purging Old SSO Token Logs

SSO tokens expire in 60 seconds. After 24 hours, the log entry has zero security value. Run a scheduled cleanup job:

```python
# In your app startup (e.g., main.py)
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
from .database import SessionLocal
from . import models

def cleanup_old_sso_tokens():
    """Delete sso_token_log rows older than 24 hours."""
    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        deleted = (
            db.query(models.SsoTokenLog)
            .filter(models.SsoTokenLog.consumed_at < cutoff)
            .delete(synchronize_session=False)
        )
        db.commit()
        if deleted:
            print(f"[SSO cleanup] Purged {deleted} expired token-log rows")
    except Exception as exc:
        db.rollback()
        print(f"[SSO cleanup] ERROR: {exc}")
    finally:
        db.close()

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_old_sso_tokens, "interval", hours=1)
scheduler.start()
```

---

## Part 4: Direct Login (Fallback / Programmatic Flow)

Some satellite apps also offer a traditional email + password login form. In this case, your app **proxies** the credentials to OS for verification — you still never store or check passwords yourself.

### 4.1 How It Works

```
  YOUR FRONTEND                YOUR BACKEND                        OS BACKEND
       │                            │                                  │
       │ POST /auth/login            │                                  │
       │ { email, password }         │                                  │
       │───────────────────────────►│                                  │
       │                            │                                  │
       │                            │ POST /auth/verify-password       │
       │                            │ { email, password, app_slug }    │
       │                            │ Header: x-internal-key           │
       │                            │─────────────────────────────────►│
       │                            │                                  │
       │                            │   { valid: true, user: {...} }   │
       │                            │◄─────────────────────────────────│
       │                            │                                  │
       │                            │ (JIT provision + issue cookie)   │
       │                            │                                  │
       │  Set-Cookie + { user }     │                                  │
       │◄───────────────────────────│                                  │
```

### 4.2 Backend Code

```python
# In your main.py or auth routes

@app.post("/auth/login")
def login(
    request: Request,
    payload: LoginRequest,    # { identifier: str, password: str }
    response: Response,
    db: Session = Depends(get_db),
):
    """Proxy login — forwards credentials to OS for verification."""
    try:
        os_res = httpx.post(
            f"{OS_BACKEND_URL}/auth/verify-password",
            json={
                "email": payload.identifier,
                "password": payload.password,
                "app_slug": "your-app-slug",   # ← Replace with your registered slug
            },
            headers={"x-internal-key": INTERNAL_API_KEY},
            timeout=10.0,
        )
        if os_res.status_code != 200:
            raise HTTPException(401, "Invalid email or password")

        os_data = os_res.json()
        if not os_data.get("valid"):
            reason = os_data.get("reason", "")
            if reason == "no_app_access":
                raise HTTPException(403, "You do not have access to this application.")
            raise HTTPException(401, "Invalid email or password")

        os_user = os_data["user"]

    except httpx.RequestError:
        raise HTTPException(503, "OS identity server unreachable")

    # ── JIT Provision (same logic as SSO Step 5) ──────────────
    os_user_id   = os_user["os_user_id"]
    is_app_admin = os_user.get("is_app_admin", False)
    is_team_lead = os_user.get("is_team_lead", False)
    user_type    = os_user.get("user_type", "employee")

    role_name = resolve_role(is_app_admin, is_team_lead, user_type)
    role = db.query(models.Role).filter(models.Role.name == role_name).first()

    user = db.query(models.User).filter(
        models.User.os_user_id == os_user_id
    ).first()

    if not user:
        user = models.User(
            os_user_id=os_user_id,
            email=os_user.get("email"),
            full_name=os_user.get("name"),
            department_slug=os_user.get("department_slug"),
            org_id=os_user.get("org_id"),
            is_app_admin=is_app_admin,
            role_id=role.id if role else None,
        )
        db.add(user)
    else:
        user.email           = os_user.get("email")
        user.full_name       = os_user.get("name")
        user.department_slug = os_user.get("department_slug")
        user.org_id          = os_user.get("org_id")
        user.is_app_admin    = is_app_admin
        if role:
            user.role_id = role.id

    db.commit()
    db.refresh(user)

    if not user.is_active:
        raise HTTPException(403, "Account deactivated")

    token = create_access_token(data={"sub": user.id})
    set_auth_cookie(response, token)

    return {
        "access_token": "",
        "token_type": "bearer",
        "user": { ... },  # Same shape as SSO response
    }
```

### 4.3 What OS Returns from `/auth/verify-password`

```json
{
  "valid": true,
  "user": {
    "os_user_id": "uuid",
    "email": "john@example.com",
    "name": "John Doe",
    "user_type": "employee",
    "department_slug": "operations",
    "department_name": "Operations",
    "is_app_admin": false,
    "is_team_lead": true,
    "org_id": null,
    "org_name": null
  }
}
```

If the user doesn't have access to your app:
```json
{ "valid": false, "reason": "no_app_access" }
```

---

## Part 5: Webhooks — Why & How

### 5.1 Why Webhooks Exist

**Problem:** If your satellite app fetched user/department data from OS on every single page load, you'd create massive network traffic, tight coupling, and your app would break whenever OS is temporarily down.

**Solution:** OS pushes changes to your app as they happen. Your app stores a local cache and queries it directly.

| Without Webhooks | With Webhooks |
|:---|:---|
| Every page load queries OS API | Your app queries its own database |
| Your app breaks when OS is down | Your app works even if OS is briefly offline |
| High network latency on every request | Near-zero latency (local SQL) |
| Cannot enforce instant access revocation | Instant status change on webhook receipt |

### 5.2 How OS Dispatches Webhooks

OS looks up all registered applications that have a `webhook_url` configured. When a relevant entity changes, OS:
1. Serializes the event payload as JSON.
2. Signs the body with HMAC-SHA256 (sent in `x-webhook-signature` header).
3. Sends `x-internal-key` header for authentication.
4. Fires the POST with **3 retries** (exponential backoff: 500ms → 1s → 2s).

### 5.3 Your Webhook Endpoint

```python
# In your main.py

class OsWebhookPayload(BaseModel):
    event: str
    os_user_id: Optional[str] = None
    email: Optional[str] = None
    department_id: Optional[str] = None
    department_slug: Optional[str] = None
    department_name: Optional[str] = None
    new_slug: Optional[str] = None
    new_name: Optional[str] = None
    timestamp: str


@app.post("/webhooks/os", status_code=200)
def os_webhook(
    payload: OsWebhookPayload,
    x_internal_key: str = Header(default=""),
    db: Session = Depends(get_db),
):
    # ── Authentication ────────────────────────────────────────
    if not INTERNAL_API_KEY or x_internal_key != INTERNAL_API_KEY:
        raise HTTPException(401, "Unauthorized")

    # ── Department Events ─────────────────────────────────────
    if payload.event == "department.created":
        # Upsert department
        ...
        return {"status": "ok", "action": "department_upserted"}

    if payload.event == "department.updated":
        # Update slug/name, cascade to user records if slug changed
        ...
        return {"status": "ok", "action": "department_updated"}

    if payload.event == "department.deleted":
        # Soft-delete locally
        ...
        return {"status": "ok", "action": "department_soft_deleted"}

    # ── User Events ───────────────────────────────────────────
    user = db.query(models.User).filter(
        models.User.os_user_id == payload.os_user_id
    ).first()

    if not user:
        return {"status": "ignored", "reason": "user_not_found"}

    if payload.event == "user.deleted":
        user.status = "deleted"
        db.commit()
        return {"status": "ok", "action": "soft_deleted"}

    if payload.event == "user.deactivated":
        user.status = "disabled"
        db.commit()
        return {"status": "ok", "action": "deactivated"}

    if payload.event == "user.reactivated":
        user.status = "active"
        db.commit()
        return {"status": "ok", "action": "reactivated"}

    return {"status": "ignored", "reason": "unknown_event"}
```

### 5.4 All Webhook Event Types

| Event | When It Fires | What Your App Should Do |
|:------|:--------------|:------------------------|
| `user.created` | New user added in OS | Optional: pre-provision user locally |
| `user.updated` | User profile changed (name, dept, etc.) | Update local cache fields |
| `user.deactivated` | Account disabled by admin | Set local status = disabled |
| `user.reactivated` | Account re-enabled | Set local status = active |
| `user.deleted` | Account permanently removed | Soft-delete, anonymize data |
| `user.app_access_revoked` | User's access to YOUR app removed | Disable user, clear sessions |
| `department.created` | New department added | Upsert local department record |
| `department.updated` | Department renamed/re-slugged | Update slug/name, cascade |
| `department.deleted` | Department removed | Soft-delete, archive resources |

---

## Part 6: Database Schema Requirements

Your app needs these tables to support OS integration:

### 6.1 Users Table (Local Cache)

```python
class User(Base):
    __tablename__ = "users"

    id              = Column(String, primary_key=True, default=generate_uuid)
    os_user_id      = Column(String, unique=True, index=True, nullable=False)  # Link to OS
    email           = Column(String, unique=True, nullable=False)              # Read-only cache
    full_name       = Column(String, nullable=False)                           # Read-only cache
    department_slug = Column(String, nullable=True)                            # Read-only cache
    org_id          = Column(String, nullable=True)                            # Read-only cache
    is_app_admin    = Column(Boolean, default=False)                           # Read-only cache
    role_id         = Column(String, ForeignKey("roles.id"), nullable=False)
    status          = Column(String, default="active")   # 'active' | 'disabled' | 'deleted'
    created_at      = Column(DateTime, default=datetime.utcnow)

    @property
    def is_active(self):
        return self.status == "active"
```

### 6.2 SSO Token Log (Replay Prevention)

```python
class SsoTokenLog(Base):
    __tablename__ = "sso_token_log"

    token_id    = Column(String, primary_key=True)          # The token_id from the JWT
    used        = Column(Boolean, default=True)
    consumed_at = Column(DateTime, default=datetime.utcnow, index=True)
    app_slug    = Column(String, nullable=True)
```

### 6.3 Departments Table (Webhook-Synced Cache)

```python
class Department(Base):
    __tablename__ = "departments"

    id                 = Column(String, primary_key=True, default=generate_uuid)
    os_department_id   = Column(String, unique=True, index=True, nullable=False)
    slug               = Column(String, unique=True, index=True, nullable=False)
    name               = Column(String, nullable=False)
    status             = Column(String, default="active")     # 'active' | 'deleted'
    created_at         = Column(DateTime, default=datetime.utcnow)
```

---

## Part 7: Checklist

Use this checklist when setting up a new satellite application:

- [ ] **Register your app** in the OS Application registry (get an `app_slug` and set a `webhook_url`)
- [ ] **Set environment variables**: `OS_BACKEND_URL`, `INTERNAL_API_KEY`, `OS_JWT_PUBLIC_KEY`, `SECRET_KEY`
- [ ] **Create database tables**: [users](file:///c:/Users/Admin/Nagarkot/OS%20AND%20ALL/training-module/backend/app/main.py#452-456) (with `os_user_id`), `sso_token_log`, [departments](file:///c:/Users/Admin/Nagarkot/OS%20AND%20ALL/training-module/backend/app/main.py#344-354), [roles](file:///c:/Users/Admin/Nagarkot/OS%20AND%20ALL/training-module/backend/app/main.py#437-442)
- [ ] **Seed roles**: Create at least `ADMIN`, `TEAM LEAD`, `EMPLOYEE`, `CLIENT` in your roles table
- [ ] **Implement SSO endpoint**: `POST /auth/sso` with all 6 verification steps
- [ ] **Implement webhook endpoint**: `POST /webhooks/os` handling all event types
- [ ] **Add SSO frontend page**: Public route at `/sso` that consumes the token
- [ ] **Add token cleanup job**: Scheduled task to purge `sso_token_log` entries older than 24h
- [ ] **Set CORS**: Allow your frontend origin with `credentials: true`
- [ ] **Test the flow**: Log into OS → click your app → verify SSO lands you in your app
- [ ] **Test webhooks**: Deactivate a user in OS → verify they are locked out of your app

> [!CAUTION]
> **Never hardcode `INTERNAL_API_KEY` or `OS_JWT_PUBLIC_KEY` in source code.** Always use environment variables or a secrets manager. These keys grant server-to-server trust — if leaked, an attacker can forge webhook payloads or bypass authentication.
