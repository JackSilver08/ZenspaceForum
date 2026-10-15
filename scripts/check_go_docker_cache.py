"""Contract test: Go Docker builds must not re-download/compile every dependency on each source edit.

The first cold compile still takes time; this guards the key layer/cache policy.
"""
from pathlib import Path

dockerfile = Path("apps/api/Dockerfile").read_text(encoding="utf-8")
go_mod = Path("apps/api/go.mod")
go_sum = Path("apps/api/go.sum")
assert go_mod.is_file() and go_sum.is_file(), "Committed Go lockfiles are required"
assert "COPY go.mod go.sum ./" in dockerfile, "Dependency layer must copy both module files"
assert "go mod download" in dockerfile and "go mod verify" in dockerfile
assert "RUN go mod tidy" not in dockerfile, "Docker build must not mutate go.mod or go.sum"
assert dockerfile.index("COPY go.mod go.sum ./") < dockerfile.index("go mod download") < dockerfile.index("COPY . .")
assert "target=/go/pkg/mod" in dockerfile, "Reuse downloaded Go modules"
assert "target=/root/.cache/go-build" in dockerfile, "Reuse compiled Go objects across source edits"
assert "go build -v" in dockerfile, "Print compiler progress to avoid an apparently frozen build"
assert "CGO_ENABLED=0" in dockerfile, "Keep current static Go binary contract"
assert 'ENTRYPOINT ["/usr/local/bin/zenspace-entrypoint"]' in dockerfile
assert "sed -i" in dockerfile, "Preserve Windows CRLF entrypoint handling"
print("Go Docker build caching & observable progress contract: OK")
