"""Home Assistant specific security auditor."""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Optional

import aiohttp

from ..models import Device, Platform, Severity, SecurityCheck, AuditResult
from .base import BaseAuditor, register_auditor


CHECKS = {
    "ha_outdated": SecurityCheck(
        id="ha-001",
        name="Outdated Home Assistant Version",
        description="Home Assistant version is outdated and may have security vulnerabilities",
        category="version",
        severity_if_failed=Severity.HIGH,
    ),
    "ha_http_enabled": SecurityCheck(
        id="ha-002",
        name="HTTP Access Enabled",
        description="Unencrypted HTTP access is enabled",
        category="encryption",
        severity_if_failed=Severity.MEDIUM,
    ),
    "ha_no_auth": SecurityCheck(
        id="ha-003",
        name="API Without Authentication",
        description="Home Assistant API is accessible without authentication",
        category="authentication",
        severity_if_failed=Severity.CRITICAL,
    ),
    "ha_exposed_secrets": SecurityCheck(
        id="ha-004",
        name="Exposed Secrets in Config",
        description="Secrets may be exposed in configuration responses",
        category="information_disclosure",
        severity_if_failed=Severity.HIGH,
    ),
    "ha_supervisor_exposed": SecurityCheck(
        id="ha-005",
        name="Supervisor API Exposed",
        description="Home Assistant Supervisor API is accessible",
        category="authentication",
        severity_if_failed=Severity.HIGH,
    ),
    "ha_addon_insecure": SecurityCheck(
        id="ha-006",
        name="Insecure Add-ons Installed",
        description="Add-ons with known security issues are installed",
        category="configuration",
        severity_if_failed=Severity.MEDIUM,
    ),
    "ha_integration_permissions": SecurityCheck(
        id="ha-007",
        name="Excessive Integration Permissions",
        description="Some integrations have more permissions than needed",
        category="configuration",
        severity_if_failed=Severity.LOW,
    ),
    "ha_long_lived_tokens": SecurityCheck(
        id="ha-008",
        name="Long-Lived Access Tokens",
        description="Long-lived access tokens in use increase attack surface",
        category="authentication",
        severity_if_failed=Severity.LOW,
    ),
    "ha_trusted_networks": SecurityCheck(
        id="ha-009",
        name="Trusted Networks Too Broad",
        description="Trusted networks configuration is too permissive",
        category="authentication",
        severity_if_failed=Severity.MEDIUM,
    ),
    "ha_remote_exposed": SecurityCheck(
        id="ha-010",
        name="Remote Access Without VPN",
        description="Home Assistant is accessible from internet without VPN",
        category="network",
        severity_if_failed=Severity.HIGH,
    ),
}

# Known vulnerable versions
VULNERABLE_VERSIONS = [
    {
        "version_range": "<2023.1.0",
        "severity": Severity.HIGH,
        "description": "Multiple security fixes in 2023.1.0",
        "cve": None,
    },
    {
        "version_range": "<2023.3.0",
        "severity": Severity.MEDIUM,
        "description": "Authentication bypass in certain configurations",
        "cve": "CVE-2023-27482",
    },
    {
        "version_range": "<2023.8.0",
        "severity": Severity.MEDIUM,
        "description": "Security improvements for webhooks",
        "cve": None,
    },
]


@register_auditor
class HomeAssistantAuditor(BaseAuditor):
    """Security auditor for Home Assistant instances."""

    @property
    def name(self) -> str:
        return "Home Assistant Auditor"

    @property
    def description(self) -> str:
        return "Security checks specific to Home Assistant installations"

    @property
    def checks(self) -> list[SecurityCheck]:
        return list(CHECKS.values())

    async def detect(self, device: Device) -> bool:
        """Detect if device is running Home Assistant."""
        # Check port
        if not device.has_port(8123):
            return False

        # Check services
        if device.platform == Platform.HOME_ASSISTANT:
            return True

        if "home_assistant" in device.services:
            return True

        # Try to detect via API
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"http://{device.ip}:8123/api/",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as response:
                    return response.status in (200, 401)
        except Exception:
            return False

    async def audit(self, device: Device) -> AuditResult:
        """Perform Home Assistant security audit."""
        self._reset()
        start_time = datetime.now()

        # Get Home Assistant info
        ha_info = await self._get_ha_info(device)

        # Run checks
        await asyncio.gather(
            self._check_version(device, ha_info),
            self._check_http_access(device),
            self._check_api_auth(device),
            self._check_supervisor(device),
            return_exceptions=True,
        )

        return self._create_result(device, start_time)

    async def _get_ha_info(self, device: Device) -> dict[str, Any]:
        """Get Home Assistant instance information."""
        info = {}

        try:
            # Try to get manifest
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"http://{device.ip}:8123/manifest.json",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        info["name"] = data.get("name")
                        info["version"] = data.get("version")
        except Exception:
            pass

        return info

    async def _check_version(self, device: Device, ha_info: dict[str, Any]) -> None:
        """Check Home Assistant version for known vulnerabilities."""
        check = CHECKS["ha_outdated"]

        version = ha_info.get("version") or device.firmware_version
        if not version:
            self.skip_check(check, "Could not determine version")
            return

        # Parse version
        try:
            version_parts = version.split(".")
            year = int(version_parts[0])
            month = int(version_parts[1])
            patch = int(version_parts[2]) if len(version_parts) > 2 else 0
        except (ValueError, IndexError):
            self.skip_check(check, f"Could not parse version: {version}")
            return

        # Check against known vulnerable versions
        for vuln in VULNERABLE_VERSIONS:
            if self._version_in_range(year, month, patch, vuln["version_range"]):
                refs = [vuln["cve"]] if vuln["cve"] else []
                self.add_finding(
                    check=check,
                    device=device,
                    description=f"Home Assistant {version} has known vulnerabilities: {vuln['description']}",
                    remediation="Update Home Assistant to the latest version",
                    evidence=f"Current version: {version}",
                    references=refs,
                    severity_override=vuln["severity"],
                )
                return

        # Check if very outdated (more than 6 months)
        current_year = 2024
        current_month = 1
        months_old = (current_year - year) * 12 + (current_month - month)

        if months_old > 6:
            self.add_finding(
                check=check,
                device=device,
                description=f"Home Assistant {version} is more than 6 months old",
                remediation="Update Home Assistant to get latest security fixes",
                evidence=f"Current version: {version}, approximately {months_old} months old",
                severity_override=Severity.MEDIUM,
            )
        else:
            self.add_passed(check, device)

    def _version_in_range(self, year: int, month: int, patch: int, version_range: str) -> bool:
        """Check if version is in vulnerability range."""
        if version_range.startswith("<"):
            target = version_range[1:]
            try:
                t_parts = target.split(".")
                t_year = int(t_parts[0])
                t_month = int(t_parts[1])
                t_patch = int(t_parts[2]) if len(t_parts) > 2 else 0

                if year < t_year:
                    return True
                if year == t_year and month < t_month:
                    return True
                if year == t_year and month == t_month and patch < t_patch:
                    return True
            except (ValueError, IndexError):
                pass

        return False

    async def _check_http_access(self, device: Device) -> None:
        """Check if HTTP (non-SSL) access is enabled."""
        check = CHECKS["ha_http_enabled"]

        # If only port 8123 is open and no HTTPS
        if device.has_port(8123) and not device.has_port(443) and not device.has_port(8443):
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"http://{device.ip}:8123/",
                        timeout=aiohttp.ClientTimeout(total=5),
                        allow_redirects=False,
                    ) as response:
                        # Check if it redirects to HTTPS
                        location = response.headers.get("Location", "")
                        if not location.startswith("https://"):
                            self.add_finding(
                                check=check,
                                device=device,
                                description="Home Assistant is accessible over unencrypted HTTP",
                                remediation="Enable SSL/TLS in Home Assistant configuration or use a reverse proxy with HTTPS",
                                references=["https://www.home-assistant.io/docs/configuration/securing/"],
                            )
                            return
            except Exception:
                pass

        self.add_passed(check, device)

    async def _check_api_auth(self, device: Device) -> None:
        """Check if API requires authentication."""
        check = CHECKS["ha_no_auth"]

        try:
            async with aiohttp.ClientSession() as session:
                # Try to access API without auth
                async with session.get(
                    f"http://{device.ip}:8123/api/states",
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as response:
                    if response.status == 200:
                        self.add_finding(
                            check=check,
                            device=device,
                            description="Home Assistant API is accessible without authentication",
                            remediation="Ensure authentication is enabled and api_password is not used",
                            evidence="GET /api/states returned 200 without credentials",
                        )
                        return
                    elif response.status == 401:
                        self.add_passed(check, device)
                        return
        except Exception:
            pass

        self.add_passed(check, device)

    async def _check_supervisor(self, device: Device) -> None:
        """Check if Supervisor API is exposed."""
        check = CHECKS["ha_supervisor_exposed"]

        supervisor_ports = [4357]  # Supervisor API port

        for port in supervisor_ports:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"http://{device.ip}:{port}/supervisor/info",
                        timeout=aiohttp.ClientTimeout(total=5),
                    ) as response:
                        if response.status in (200, 401):
                            self.add_finding(
                                check=check,
                                device=device,
                                description=f"Home Assistant Supervisor API is accessible on port {port}",
                                remediation="Ensure Supervisor API is only accessible from localhost",
                                references=["https://developers.home-assistant.io/docs/api/supervisor/"],
                            )
                            return
            except Exception:
                continue

        self.add_passed(check, device)
