# Authentication & Authorization

## Authentication (JWT)

- The backend exposes `POST /auth/login` using OAuth2 password flow.
- The response includes a JWT access token.
- The frontend stores the token in `localStorage` under `access_token`.
- All authenticated API calls include `Authorization: Bearer <token>`.

## Bootstrap Admin

On a fresh database, there are no users. The UI provides **Bootstrap Admin** which calls:

- `POST /auth/bootstrap`

This endpoint:

- Only succeeds if no active `admin` user exists yet
- Creates an `admin` user

## Forgot the admin password? (dev)

- Reset the database (Docker) or
- Reset the password directly:
  `backend\.venv\Scripts\python.exe -B backend\scripts\reset_user_password.py --email you@example.com --password "NewPassword123"`

## Roles

- `admin`
  - Can create users (including other admins) via `POST /users`
- `store_manager`
  - Inventory custody, receipt/issue/returns
- `technician`
  - Request parts and record usage
- `manager`
  - Approval and reporting
- `approver`
  - Approve requests

## Session handling

- Logging out removes the token from `localStorage`.
- Invalid/expired tokens return `401` from the backend; the UI should redirect to `/login`.

## Disable auth (dev only)

- Backend: `DISABLE_AUTH` defaults to `true` in this dev setup (set to `false` to re-enable JWT auth).
  - If no users exist, a dev admin is auto-created: `dev@local` / `dev-admin`.
- Frontend: `VITE_DISABLE_AUTH` defaults to `true` in this dev setup (set to `false` to show the login screen).

## Approval thresholds

- `APPROVAL_THRESHOLD_MANAGER` and `APPROVAL_THRESHOLD_ADMIN` control which role must approve stock requests based on total value.
