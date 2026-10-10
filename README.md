# ZenspaceForum

Forum web project with the existing HTML/CSS/JavaScript frontend and Go API. MySQL, Redis, Go, and Nginx run through Docker Compose.

## Run on Windows

1. Install and open Docker Desktop. Wait until Docker Engine is ready.
2. Clone/download this repository.
3. Run `START.bat` from the repository root (PowerShell: `./START.bat`).

The launcher creates a local-only `.env` with generated MySQL/JWT secrets, selects available host ports, starts the stack, waits for the API and website, opens the browser, and follows container logs.

Default preferred ports are website `8089`, API `8081`, and MySQL `3307`. If a port is already occupied, the launcher selects a free nearby port and stores it in `.env`; use the URLs printed by the launcher.

Run `STOP.bat` to stop containers without deleting the database volume. Do not run `docker compose down -v` unless you intend to delete the database.

## Data

- MySQL data: Docker named volume `zenspace_mysql_data`.
- Uploaded media: local `data/uploads`.
- `ZenSpaceDB_latest.sql` is imported only when MySQL initializes a new data volume.
- The SQL file contains sanitized demo accounts. All demo accounts use password `ZenSpaceDemo123!`; this is strictly for local development and is not suitable for production.

## Important

- Do not commit `.env` or anything under `data/`.
- Use the root `docker-compose.yml` and `START.bat` for the normal startup path.
- This project still uses its existing plain-text password comparison in application code; do not deploy publicly without adding password hashing and appropriate production security controls.
