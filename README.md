# ZenSpace Social (v2)

The legacy forum is being modernized into a social network using **React + Vite + Bootstrap 5**, **Go + Gin**, and **MySQL**. Redis is optional. The original code and database import are retained.

## Getting started
1. Start Docker Desktop.
2. Clone the repository and run START.bat in the repository root.
3. The launcher generates local .env values, builds Go/React, starts MySQL + Redis + API + Nginx and opens the website.
4. Default ports: web 8089, API 8081, MySQL 3307 (automatically changed if occupied).

Use STOP.bat to stop the services while keeping persistent data. Do not use docker compose down -v unless intentionally deleting the database.

See ARCHITECTURE.md for migration and backup information. The original frontend/backend is under docs/.

**Security:** The original SQL data has demo accounts with plaintext passwords. Successful login upgrades a legacy password to bcrypt. Do not deploy publicly with demo credentials. Audit and integration testing are required before production.
