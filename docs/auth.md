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

## Roles

- `admin`
  - Can create users via `POST /users`
- `staff`
  - Standard operational access

## Session handling

- Logging out removes the token from `localStorage`.
- Invalid/expired tokens return `401` from the backend; the UI should redirect to `/login`.
