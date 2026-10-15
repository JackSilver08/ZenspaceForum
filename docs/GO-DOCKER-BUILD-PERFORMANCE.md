# ZenSpace: slow local Docker backend build

## What the user observed
`START.bat` printed a successful Vite build and then remained at
`[backend build 5/5] RUN go mod tidy && go mod verify && CGO_ENABLED=0 go build...`
for 217.5 seconds. It was interrupted using "Terminate batch job (Y/N)? Y".
There is no Go compilation error in that log; cancellation does not prove deadlock.

## Identified avoidable work
The old Dockerfile copied only `go.mod` then copied the entire source before
running `go mod tidy`, despite `apps/api/go.sum` already being tracked.
Every source edit invalidated that layer and could re-download modules and redo
cold compilation. `go build` without `-v` produces little to no progress.

## Fix
- Copy `go.mod` **and** `go.sum` first. Cache `go mod download` and
  `go mod verify` in their own Docker layer.
- Keep Go module downloads in a BuildKit cache mount at `/go/pkg/mod`.
- Keep Go compiled objects in a separate BuildKit cache mount at
  `/root/.cache/go-build`, so recompiling changed source is incremental.
- Run `go build -v` to print package-level progress.
- Keep the existing Go version, Alpine runtime, non-root entrypoint,
  uploads volume, API routes and database unchanged.
- Run `go mod tidy` (when needed) during source maintenance and CI, not inside
  the production Docker image build.

## Windows steps

```powershell
git switch main
git pull --ff-only origin main
docker compose build --progress=plain backend
docker compose up -d
docker compose ps
```

Then open http://localhost:8089. You can also use `START.bat` after updating:
it rebuilds both images and checks service health.

On the **first cold build**, all Go dependencies still need downloading and
compiling. Several minutes can be normal, especially with low CPU/RAM available
to Docker Desktop. BuildKit cache mounts accelerate subsequent builds but are
not permanent (Docker's cache garbage collection can remove them).

If compile still seems frozen after several minutes:
- Check Docker Desktop's CPU/RAM graphs and WSL2 resource limits.
- Run `docker system df` to check free space and build cache size.
- Run `docker compose build --progress=plain backend` to isolate Go output.
- Check network access if the output pauses at `go mod download`.
- If CPU remains idle for a long time and no progress appears, collect the
  last 50 build-log lines plus Docker Desktop's Resources settings.

**Never run `docker compose down -v`, `docker volume prune`, or delete
`mysql_data` to fix a compile slowdown.** Those commands can erase data.

## Regression prevention
`scripts/check_go_docker_cache.py` is run on every GitHub Actions PR/build;
Docker smoke CI also builds the image from scratch and checks service health.
