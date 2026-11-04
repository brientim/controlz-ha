#!/usr/bin/env python3
"""
Build and deploy ControlZ HA cards to a Home Assistant install.

  1. npm run build → dist/controlz-ha.js
  2. Copy to HA config/www/ (served as /local/controlz-ha.js)
  3. Register or update the Lovelace module resource with a ?v=<hash> cache buster
  4. Create the "ControlZ" dashboard (/dashboard-controlz) driven by the
     custom:controlz-rooms strategy (backs up any existing config first)

Env:
  HA_TOKEN              long-lived access token (required)
  HA_URL                default http://homeassistant.local:8123
  HA_WWW_SCP_TARGET     e.g. root@homeassistant.local:/config/www/   (or HA_CONFIG_PATH for a mounted config dir)
  HA_WWW_SCP_IDENTITY   optional ssh key for scp

Usage:
  python3 scripts/deploy.py
  python3 scripts/deploy.py --tile-size compact
  python3 scripts/deploy.py --cards-only        # upload + resource, leave dashboards alone
  python3 scripts/deploy.py --status
  python3 scripts/deploy.py --remove-local      # after installing through HACS: drop the /local copy
  python3 scripts/deploy.py --marketplace       # HA 2026.11+: install/update from the Marketplace,
                                                # then drop the /local copy and ensure the dashboard

When ControlZ HA is installed through HACS (/hacsfiles/controlz-ha/) or the Home Assistant 2026.11+
Marketplace (/local/community/controlz-ha/), the /local resource is not registered, so only one
copy of the cards loads; the dashboard is still created/updated.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

try:
    import requests
    from websocket import create_connection
except ImportError:
    print("pip install requests websocket-client", file=sys.stderr)
    sys.exit(1)

REPO = Path(__file__).resolve().parent.parent
DIST = REPO / "dist" / "controlz-ha.js"
BACKUPS = REPO / "backups"
REMOTE_NAME = "controlz-ha.js"
GITHUB_REPOSITORY = "brientim/controlz-ha"
RESOURCE_PATH = f"/local/{REMOTE_NAME}"
# HACS (Home Assistant ≤ 2026.10) and the built-in Marketplace (2026.11+, which replaced HACS).
STORE_RESOURCE_PREFIXES = ("/hacsfiles/controlz-ha/", "/local/community/controlz-ha/")
DASHBOARD_PATH = "dashboard-controlz"
STRATEGY_TYPE = "custom:controlz-rooms"

HA_URL = os.environ.get("HA_URL", "http://homeassistant.local:8123").rstrip("/")
HA_TOKEN = os.environ.get("HA_TOKEN", "")


class HAWebSocket:
    def __init__(self, ha_url: str, token: str) -> None:
        self.ws = create_connection(ha_url.replace("http", "ws", 1) + "/api/websocket", timeout=60)
        json.loads(self.ws.recv())
        self.ws.send(json.dumps({"type": "auth", "access_token": token}))
        auth = json.loads(self.ws.recv())
        if auth.get("type") != "auth_ok":
            raise RuntimeError(f"Auth failed: {auth.get('message', auth.get('type'))}")
        self.ha_version = auth.get("ha_version", "?")
        self._id = 0

    def call(self, msg_type: str, **kwargs) -> dict:
        self._id += 1
        self.ws.send(json.dumps({"id": self._id, "type": msg_type, **kwargs}))
        while True:
            r = json.loads(self.ws.recv())
            if r.get("id") == self._id:
                return r

    def ok(self, msg_type: str, **kwargs):
        r = self.call(msg_type, **kwargs)
        if not r.get("success"):
            raise RuntimeError(f"{msg_type} failed: {r.get('error', r)}")
        return r.get("result")

    def close(self) -> None:
        self.ws.close()


def build() -> None:
    subprocess.run(["npm", "run", "build", "--silent"], cwd=REPO, check=True)
    print(f"build: {DIST.relative_to(REPO)} ({DIST.stat().st_size // 1024} KB)")


def bundle_hash() -> str:
    return hashlib.sha1(DIST.read_bytes()).hexdigest()[:10]


def upload() -> None:
    config_path = os.environ.get("HA_CONFIG_PATH", "").strip()
    if config_path:
        dest = Path(config_path) / "www" / REMOTE_NAME
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(DIST, dest)
        print(f"www: copied → {dest}")
        return
    target = os.environ.get("HA_WWW_SCP_TARGET", "").strip()
    if not target:
        raise RuntimeError("Set HA_WWW_SCP_TARGET (user@host:/config/www/) or HA_CONFIG_PATH")
    cmd = ["scp", "-q"]
    identity = os.environ.get("HA_WWW_SCP_IDENTITY", "").strip()
    if identity:
        cmd += ["-i", identity, "-o", "IdentitiesOnly=yes"]
    cmd += [str(DIST), target.rstrip("/") + "/" + REMOTE_NAME]
    subprocess.run(cmd, check=True, timeout=120)
    print(f"www: scp → {target.rstrip('/')}/{REMOTE_NAME}")


def hacs_resource(resources: list[dict]) -> dict | None:
    """Resource added by HACS or the Marketplace, if ControlZ HA was installed from the store."""
    return next((r for r in resources if (r.get("url") or "").startswith(STORE_RESOURCE_PREFIXES)), None)


def local_resource(resources: list[dict]) -> dict | None:
    return next((r for r in resources if (r.get("url") or "").split("?")[0] == RESOURCE_PATH), None)


def ensure_resource(ws: HAWebSocket, version: str) -> bool:
    """Register/update the /local resource. Returns False when HACS already provides the cards."""
    url = f"{RESOURCE_PATH}?v={version}"
    resources = ws.ok("lovelace/resources") or []
    hacs = hacs_resource(resources)
    if hacs:
        print(f"resource: HACS / Marketplace provides the cards ({hacs['url']}); /local copy not registered.")
        if local_resource(resources):
            print("  warning: a /local copy is also registered — run with --remove-local.")
        return False
    existing = next((r for r in resources if (r.get("url") or "").split("?")[0] == RESOURCE_PATH), None)
    if existing and existing.get("url") == url:
        print(f"resource: up to date ({url})")
    elif existing:
        ws.ok("lovelace/resources/update", resource_id=existing["id"], res_type="module", url=url)
        print(f"resource: updated → {url}")
    else:
        ws.ok("lovelace/resources/create", res_type="module", url=url)
        print(f"resource: registered → {url}")
    return True


def remove_local(ws: HAWebSocket) -> None:
    resources = ws.ok("lovelace/resources") or []
    existing = local_resource(resources)
    if existing:
        ws.ok("lovelace/resources/delete", resource_id=existing["id"])
        print(f"resource: removed {existing['url']}")
    else:
        print("resource: no /local copy registered")
    target = os.environ.get("HA_WWW_SCP_TARGET", "").strip()
    config_path = os.environ.get("HA_CONFIG_PATH", "").strip()
    if config_path:
        (Path(config_path) / "www" / REMOTE_NAME).unlink(missing_ok=True)
        print(f"www: removed {REMOTE_NAME}")
    elif target and ":" in target:
        host, path = target.split(":", 1)
        cmd = ["ssh", "-o", "BatchMode=yes"]
        identity = os.environ.get("HA_WWW_SCP_IDENTITY", "").strip()
        if identity:
            cmd += ["-i", identity, "-o", "IdentitiesOnly=yes"]
        subprocess.run(cmd + [host, f"rm -f {path.rstrip('/')}/{REMOTE_NAME}"], check=True, timeout=60)
        print(f"www: removed {REMOTE_NAME} on {host}")
    else:
        print(f"www: delete config/www/{REMOTE_NAME} by hand (set HA_WWW_SCP_TARGET or HA_CONFIG_PATH to automate)")


def backup_dashboard(config: dict) -> None:
    BACKUPS.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = BACKUPS / f"{DASHBOARD_PATH}_{stamp}.json"
    out.write_text(json.dumps(config, indent=2) + "\n")
    print(f"dashboard: backup → {out.relative_to(REPO)}")


def ensure_dashboard(ws: HAWebSocket, tile_size: str | None, force: bool) -> None:
    dashboards = ws.ok("lovelace/dashboards/list") or []
    if not any(d.get("url_path") == DASHBOARD_PATH for d in dashboards):
        ws.ok(
            "lovelace/dashboards/create",
            url_path=DASHBOARD_PATH,
            title="ControlZ",
            icon="mdi:view-dashboard-variant",
            show_in_sidebar=True,
            require_admin=False,
        )
        print(f"dashboard: created /{DASHBOARD_PATH}")

    current = ws.call("lovelace/config", url_path=DASHBOARD_PATH, force=False)
    current_config = current.get("result") if current.get("success") else None
    if current_config:
        if current_config.get("strategy", {}).get("type") != STRATEGY_TYPE and not force:
            print(
                f"dashboard: /{DASHBOARD_PATH} has a hand-edited config (not {STRATEGY_TYPE}); "
                "left unchanged. Re-run with --force to replace it (a backup is written first)."
            )
            return
        backup_dashboard(current_config)

    existing = (current_config or {}).get("strategy", {})
    strategy = {**existing, "type": STRATEGY_TYPE, "tile_size": tile_size or existing.get("tile_size", "large")}
    if strategy == existing:
        print(f"dashboard: /{DASHBOARD_PATH} unchanged {json.dumps(strategy)}")
        return
    ws.ok("lovelace/config/save", url_path=DASHBOARD_PATH, config={"strategy": strategy})
    print(f"dashboard: /{DASHBOARD_PATH} → strategy {json.dumps(strategy)}")


def find_repository(ws: HAWebSocket) -> dict | None:
    repos = ws.ok("marketplace/repositories/list") or []
    return next((r for r in repos if (r.get("full_name") or "").lower() == GITHUB_REPOSITORY), None)


def marketplace_install(ws: HAWebSocket, timeout_s: int = 180) -> bool:
    """Install or update ControlZ HA through the Home Assistant 2026.11+ Marketplace.

    The one-time consent steps (accepting the community-content warning, connecting GitHub)
    are left to the user in Settings → Marketplace; this never accepts the warning for them.
    """
    r = ws.call("marketplace/info")
    if not r.get("success"):
        print(f"marketplace: not available ({r.get('error', {}).get('message', r)}) — needs Home Assistant 2026.11+")
        return False
    info = r["result"]
    print(f"marketplace: version {info.get('version')}, stage {info.get('stage')}, "
          f"warning accepted {info.get('warning_accepted')}, GitHub connected {info.get('github_connected')}")
    if info.get("disabled_reason"):
        print(f"marketplace: disabled ({info['disabled_reason']})")
        return False
    if not info.get("warning_accepted") or not info.get("github_connected"):
        print("marketplace: open Settings → Marketplace and accept the warning / connect GitHub first "
              "(needed once to add a custom repository), then run this again.")
        return False

    repo = find_repository(ws)
    if not repo:
        ws.ok("marketplace/repositories/add", repository=GITHUB_REPOSITORY, category="plugin")
        print(f"marketplace: added custom repository {GITHUB_REPOSITORY}")
        repo = find_repository(ws)
    if not repo:
        print("marketplace: repository did not appear after adding it")
        return False
    # Custom repositories are only re-checked about every 48 h; ask for the latest release now.
    refreshed = ws.call("marketplace/repository/refresh", repository=repo["id"])
    if refreshed.get("success"):
        repo = find_repository(ws) or repo
    print(f"marketplace: {repo['full_name']} installed {repo.get('installed_version') or '-'} "
          f"available {repo.get('available_version')}")
    if repo.get("installed") and repo.get("installed_version") == repo.get("available_version"):
        print("marketplace: already up to date")
        return True

    ws.ok("marketplace/repository/install", repository=repo["id"])
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        repo = find_repository(ws) or {}
        if repo.get("installed") and repo.get("installed_version") == repo.get("available_version"):
            print(f"marketplace: installed {repo['installed_version']} → {repo.get('local_path')}")
            return True
        time.sleep(3)
    print("marketplace: install did not finish in time — check Settings → Marketplace")
    return False


def status(ws: HAWebSocket) -> int:
    print(f"HA {ws.ha_version} at {HA_URL}")
    try:
        code = requests.get(f"{HA_URL}{RESOURCE_PATH}", timeout=8).status_code
    except requests.RequestException as exc:
        code = f"error: {exc}"
    print(f"GET {RESOURCE_PATH} → {code}")
    resources = ws.ok("lovelace/resources") or []
    ours = [r.get("url") for r in resources if RESOURCE_PATH in (r.get("url") or "") or (r.get("url") or "").startswith(STORE_RESOURCE_PREFIXES)]
    print(f"resource: {ours or 'not registered'}")
    if hacs_resource(resources) and local_resource(resources):
        print("  warning: both HACS / Marketplace and /local copies are registered — run with --remove-local.")
    if DIST.is_file():
        print(f"local bundle hash: {bundle_hash()}")
    dashboards = ws.ok("lovelace/dashboards/list") or []
    dash = next((d for d in dashboards if d.get("url_path") == DASHBOARD_PATH), None)
    print(f"dashboard: {'/' + DASHBOARD_PATH if dash else 'not created'}")
    if dash:
        r = ws.call("lovelace/config", url_path=DASHBOARD_PATH, force=False)
        print(f"  config: {json.dumps(r.get('result')) if r.get('success') else 'empty'}")
    areas = ws.ok("config/area_registry/list") or []
    print(f"areas: {len(areas)}")
    return 0 if ours and (code == 200 or hacs_resource(resources)) else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy ControlZ HA cards to Home Assistant")
    parser.add_argument("--status", action="store_true", help="show install status only")
    parser.add_argument("--tile-size", choices=["large", "thin", "compact"], default=None,
                        help="dashboard default tile size (default: keep the current setting, else large)")
    parser.add_argument("--cards-only", action="store_true", help="upload + resource only; do not touch dashboards")
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--force", action="store_true", help="replace a hand-edited ControlZ dashboard (backed up first)")
    parser.add_argument("--remove-local", action="store_true", help="remove the /local copy (use after installing through HACS / Marketplace)")
    parser.add_argument("--marketplace", action="store_true",
                        help="HA 2026.11+: install/update ControlZ HA from the Marketplace, remove the /local copy, ensure the dashboard")
    args = parser.parse_args()

    if not HA_TOKEN:
        print("Set HA_TOKEN to a long-lived access token.", file=sys.stderr)
        return 2

    ws = HAWebSocket(HA_URL, HA_TOKEN)
    try:
        if args.status:
            return status(ws)
        if args.remove_local:
            remove_local(ws)
            return status(ws)
        if args.marketplace:
            if not marketplace_install(ws):
                return 1
            remove_local(ws)
            ensure_dashboard(ws, args.tile_size, args.force)
            return status(ws)
        resources = ws.ok("lovelace/resources") or []
        if not hacs_resource(resources):
            if not args.skip_build:
                build()
            upload()
        ensure_resource(ws, bundle_hash() if DIST.is_file() else "none")
        if not args.cards_only:
            ensure_dashboard(ws, args.tile_size, args.force)
        print(f"\nOpen {HA_URL}/{DASHBOARD_PATH}/rooms (hard-reload the browser after updates).")
        return 0
    finally:
        ws.close()


if __name__ == "__main__":
    raise SystemExit(main())
