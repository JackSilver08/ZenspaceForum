# One-command local launcher for ZenSpace on Windows + Docker Desktop.
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
$EnvPath = Join-Path $RepoRoot '.env'
$EnvExamplePath = Join-Path $RepoRoot '.env.example'

function Read-EnvLines {
    if (-not (Test-Path $EnvPath)) {
        if (-not (Test-Path $EnvExamplePath)) {
            throw 'Missing .env.example. Pull the latest main branch and try again.'
        }
        Copy-Item $EnvExamplePath $EnvPath
        Write-Host '[INFO] Created local .env.'
    }
    $script:EnvLines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in [System.IO.File]::ReadAllLines($EnvPath)) {
        [void]$script:EnvLines.Add($line)
    }
}

function Get-EnvValue([string]$Key) {
    $pattern = '^\s*' + [regex]::Escape($Key) + '\s*=(.*)$'
    for ($i = $script:EnvLines.Count - 1; $i -ge 0; $i--) {
        if ($script:EnvLines[$i] -match $pattern) {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return ''
}

function Set-EnvValue([string]$Key, [string]$Value) {
    $pattern = '^\s*' + [regex]::Escape($Key) + '\s*='
    for ($i = 0; $i -lt $script:EnvLines.Count; $i++) {
        if ($script:EnvLines[$i] -match $pattern) {
            $script:EnvLines[$i] = "$Key=$Value"
            return
        }
    }
    [void]$script:EnvLines.Add("$Key=$Value")
}

function Save-Env {
    $encoding = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllLines($EnvPath, $script:EnvLines.ToArray(), $encoding)
}

function Test-PortAvailable([int]$Port) {
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($null -ne $listener) {
            try { $listener.Stop() } catch { }
        }
    }
}

function Test-PortBelongsToZenSpace([string]$Service, [int]$ContainerPort, [int]$HostPort) {
    $ids = @(& docker ps --filter 'status=running' --filter 'label=com.docker.compose.project=zenspace' --filter "label=com.docker.compose.service=$Service" --format '{{.ID}}' 2>$null)
    foreach ($id in $ids) {
        if ([string]::IsNullOrWhiteSpace([string]$id)) { continue }
        $json = & docker inspect --format '{{json .NetworkSettings.Ports}}' $id 2>$null
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($json -join ''))) { continue }
        try {
            $mappings = ($json -join '') | ConvertFrom-Json
            $property = $mappings.PSObject.Properties["$ContainerPort/tcp"]
            if ($null -eq $property -or $null -eq $property.Value) { continue }
            foreach ($binding in @($property.Value)) {
                if ($null -ne $binding -and [int]$binding.HostPort -eq $HostPort) {
                    return $true
                }
            }
        } catch { }
    }
    return $false
}

function Resolve-HostPort([string]$Key, [string]$Service, [int]$ContainerPort, [int]$DefaultPort) {
    $raw = Get-EnvValue $Key
    $preferred = $DefaultPort
    if ($raw -match '^\d+$') {
        $candidateValue = [int]$raw
        if ($candidateValue -ge 1024 -and $candidateValue -le 65535) {
            $preferred = $candidateValue
        }
    }

    for ($candidate = $preferred; $candidate -le [Math]::Min(65535, $preferred + 100); $candidate++) {
        if ($script:ReservedPorts.Contains($candidate)) { continue }
        $available = Test-PortAvailable $candidate
        $owned = Test-PortBelongsToZenSpace $Service $ContainerPort $candidate
        if ($available -or $owned) {
            [void]$script:ReservedPorts.Add($candidate)
            Set-EnvValue $Key ([string]$candidate)
            if ($candidate -ne $preferred) {
                Write-Host "[INFO] Port $preferred is busy; using $candidate for $Service."
            }
            return $candidate
        }
    }
    throw "No free host port found for $Service near $preferred. Edit $EnvPath or stop the conflicting application."
}

function Test-HttpReady([string]$Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 3 -UseBasicParsing
        return ($response.StatusCode -eq 200)
    } catch {
        return $false
    }
}

try {
    Write-Host ''
    Write-Host '=========================================='
    Write-Host ' ZenSpace - Docker environment'
    Write-Host '=========================================='

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw 'Docker was not found. Install Docker Desktop and open it first: https://www.docker.com/products/docker-desktop/'
    }
    & docker compose version 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose is not available. Update Docker Desktop and try again.'
    }
    & docker info 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Engine is not ready. Open Docker Desktop and wait until it finishes starting.'
    }

    Read-EnvLines

    foreach ($key in @('MYSQL_ROOT_PASSWORD', 'JWT_SECRET')) {
        if ([string]::IsNullOrWhiteSpace((Get-EnvValue $key))) {
            $secret = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
            Set-EnvValue $key $secret
            Write-Host "[INFO] Generated a local $key in .env."
        }
    }

    foreach ($portSetting in @(
        @{ Key = 'WEB_PORT'; Default = 8089 },
        @{ Key = 'API_PORT'; Default = 8081 },
        @{ Key = 'MYSQL_PORT'; Default = 3307 }
    )) {
        $value = Get-EnvValue $portSetting.Key
        if ($value -notmatch '^\d+$' -or [int]$value -lt 1024 -or [int]$value -gt 65535) {
            Set-EnvValue $portSetting.Key ([string]$portSetting.Default)
        }
    }
    Save-Env

    $script:ReservedPorts = [System.Collections.Generic.HashSet[int]]::new()
    $webPort = Resolve-HostPort 'WEB_PORT' 'web' 80 8089
    $apiPort = Resolve-HostPort 'API_PORT' 'backend' 8080 8081
    $mysqlPort = Resolve-HostPort 'MYSQL_PORT' 'db' 3306 3307
    Save-Env

    $composeJson = & docker compose config --format json
    if ($LASTEXITCODE -ne 0) {
        throw 'docker-compose.yml is invalid. Check the file and .env, then try again.'
    }

    $settings = ($composeJson -join [Environment]::NewLine) | ConvertFrom-Json
    $apiContext = [System.IO.Path]::GetFullPath([string]$settings.services.backend.build.context)
    $webContext = [System.IO.Path]::GetFullPath([string]$settings.services.web.build.context)
    $expectedApi = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps/api'))
    $expectedWeb = [System.IO.Path]::GetFullPath((Join-Path $RepoRoot 'apps/web'))
    if ($apiContext -ne $expectedApi -or $webContext -ne $expectedWeb) {
        throw 'Docker Compose must build apps/api and apps/web, not legacy paths.'
    }

    $siteUrl = "http://localhost:$webPort"
    $apiUrl = "http://127.0.0.1:$apiPort/healthz"
    Write-Host ''
    Write-Host " Website: $siteUrl"
    Write-Host " API:     $apiUrl"
    Write-Host " MySQL:   127.0.0.1:$mysqlPort"
    Write-Host ''
    Write-Host '[INFO] Building and starting MySQL, Redis, Go API, and Nginx...'
    Write-Host '[INFO] First backend compile may take several minutes; Go module and compiler caches speed up later builds.'

    & docker compose up --build -d --remove-orphans
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[ERROR] Docker Compose failed. Recent logs follow:'
        & docker compose ps
        & docker compose logs --tail=150 db redis backend web
        exit 1
    }

    Write-Host '[INFO] Waiting for the API and website to become ready...'
    $deadline = (Get-Date).AddMinutes(3)
    $ready = $false
    do {
        $apiReady = Test-HttpReady $apiUrl
        $webReady = Test-HttpReady $siteUrl
        if ($apiReady -and $webReady) {
            $ready = $true
            break
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)

    if (-not $ready) {
        Write-Host '[ERROR] API or website did not become ready within 3 minutes. Recent logs follow:'
        & docker compose ps
        & docker compose logs --tail=150 db redis backend web
        exit 1
    }

    Write-Host '[OK] ZenSpace is ready. Opening the browser...'
    Start-Process $siteUrl
    Write-Host '[INFO] Following container logs. Press Ctrl+C to stop following logs; containers keep running.'
    Write-Host '[INFO] Run STOP.bat to stop the services.'
    & docker compose logs --follow --tail=100
    exit 0
} catch {
    Write-Host ''
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
