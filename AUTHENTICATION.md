# Grocea PWA Authentication v1

`AuthProvider` resolves the HttpOnly session before mounting product routes.
`/welcome`, `/login`, and `/register` are public; every product route is
guarded and preserves a sanitized internal return target.

The CSRF token is held in React memory only. Account state, outbox entries,
device IDs, and import IDs live in `grocea:<account-id>` IndexedDB databases;
credentials never enter Web Storage or IndexedDB. New accounts fetch server
state before rendering. An old unowned `grocea` database pauses the product
gate for an explicit move or destructive delete decision. Session expiry keeps
pending mutations and returns to sign-in; successful logout purges the active
account cache and broadcasts the lock to other tabs.
