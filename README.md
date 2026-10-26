# Quote of the day

A tiny Node.js server with no dependencies. It shows one quote per day and has an admin page for adding and deleting quotes, stored in SQLite through Node's built-in `node:sqlite` module.

## Run

Requires Node.js 22.13 or newer.

```sh
npm start
```

- `http://localhost:3000/`: today's quote (same for everyone, changes at midnight UTC)
- `http://localhost:3000/admin`: add and delete quotes

The admin page has **no authentication**. Anyone who can reach the server can change the quotes, so don't expose it publicly as is.

## Configuration

| Variable  | Default       | Description              |
|-----------|---------------|--------------------------|
| `PORT`    | `3000`        | Port to listen on        |
| `DB_PATH` | `./quotes.db` | Path to the SQLite file  |

The database is created on first start and seeded with three quotes.
