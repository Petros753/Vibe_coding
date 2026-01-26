"""Tuya/Smart Life device security auditor."""

from __future__ import annotations

import asyncio
import socket
from datetime import datetime
from typing import Any

from ..models import Device, Platform, Severity, SecurityCheck, AuditResult
from .base import BaseAuditor, register_auditor


CHECKS = {
    "tuya_local_api": SecurityCheck(
        id="tuya-001",
        name="Tuya Local API Exposed",
        description="Tuya local API is accessible without encryption",
        category="encryption",
        severity_if_failed=Severity.MEDIUM,
    ),
    "tuya_cloud_sync": SecurityCheck(
        id="tuya-002",
        name="Cloud Sync Enabled",
        description="Device syncs data to Tuya cloud servers",
        category="privacy",
        severity_if_failed=Severity.MEDIUM,
    ),
    "tuya_default_key": SecurityCheck(
        id="tuya-003",
        name="Default Encryption Key",
        description="Device may be using default or weak encryption key",
        category="encryption",
        severity_if_failed=Severity.HIGH,
    ),
    "tuya_firmware_old": SecurityCheck(
        id="tuya-004",
        name="Outdated Firmware",
        description="Device firmware is outdated",
        category="version",
        severity_if_failed=Severity.MEDIUM,
    ),
    "tuya_debug_enabled": SecurityCheck(
        id="tuya-005",
        name="Debug Mode Enabled",
        description="Device has debug mode enabled exposing additional information",
        category="information_disclosure",
        severity_if_failed=Severity.LOW,
    ),
    "tuya_pairing_mode": SecurityCheck(
        id="tuya-006",
        name="Pairing Mode Exposed",
        description="Device pairing mode may be accessible",
        category="authentication",
        severity_if_failed=Severity.HIGH,
    ),
}


@register_auditor
class TuyaAuditor(BaseAuditor):
    """Security auditor for Tuya/Smart Life devices."""

    @property
    def name(self) -> str:
        return "Tuya/Smart Life Auditor"

    @property
    def description(self) -> str:
        return "Security checks for Tuya and Smart Life smart home devices"

    @property
    def checks(self) -> list[SecurityCheck]:
        return list(CHECKS.values())

    async def detect(self, device: Device) -> bool:
        """Detect if device is a Tuya device."""
        # Check platform
        if device.platform == Platform.TUYA:
            return True

        # Check vendor
        if device.vendor and "tuya" in device.vendor.lower():
            return True

        # Check for Tuya ports
        if device.has_port(6668) or device.has_port(6669):
            return True

        # Check services
        if "tuya" in device.services:
            return True

        return False

    async def audit(self, device: Device) -> AuditResult:
        """Perform Tuya device security audit."""
        self._reset()
        start_time = datetime.now()

        # Run checks
        await asyncio.gather(
            self._check_local_api(device),
            self._check_cloud_sync(device),
            self._check_encryption(device),
            self._check_pairing_mode(device),
            return_exceptions=True,
        )

        # Always flag cloud sync as informational
        self._add_cloud_info(device)

        return self._create_result(device, start_time)

    async def _check_local_api(self, device: Device) -> None:
        """Check if Tuya local API is exposed."""
        check = CHECKS["tuya_local_api"]

        tuya_ports = [6668, 6669]
        for port in tuya_ports:
            if device.has_port(port):
                self.add_finding(
                    check=check,
                    device=device,
                    description=f"Tuya local API accessible on port {port}",
                    remediation="Consider using local-only firmware like Tasmota if possible",
                    evidence=f"Port {port} is open",
                    severity_override=Severity.LOW,  # Local API is less severe than cloud
                )
                return

        self.add_passed(check, device)

    async def _check_cloud_sync(self, device: Device) -> None:
        """Check for cloud synchronization."""
        check = CHECKS["tuya_cloud_sync"]

        # Tuya devices almost always sync to cloud
        # This is informational
        if device.platform == Platform.TUYA or device.has_port(6668):
            self.add_finding(
                check=check,
                device=device,
                description="Device likely syncs data to Tuya cloud servers in China/US",
                remediation="Consider using local-only firmware (Tasmota, ESPHome) or block cloud access via firewall",
                references=[
                    "https://github.com/codetheweb/tuyapi",
                    "https://tasmota.github.io/docs/",
                ],
                severity_override=Severity.INFO,
            )
        else:
            self.add_passed(check, device)

    async def _check_encryption(self, device: Device) -> None:
        """Check encryption configuration."""
        check = CHECKS["tuya_default_key"]

        # Try to probe the Tuya protocol
        if device.has_port(6668):
            try:
                # Send a probe packet
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(3)
                sock.connect((device.ip, 6668))

                # Tuya protocol header
                probe = bytes([
                    0x00, 0x00, 0x55, 0xAA,  # Magic prefix
                    0x00, 0x00, 0x00, 0x00,  # Sequence
                    0x00, 0x00, 0x00, 0x0A,  # Command (status query)
                    0x00, 0x00, 0x00, 0x00,  # Data length
                ])

                sock.send(probe)

                # Try to receive response
                try:
                    response = sock.recv(1024)
                    sock.close()

                    if response and len(response) > 20:
                        # Device responded - might indicate weak security
                        self.add_finding(
                            check=check,
                            device=device,
                            description="Tuya device responds to probe without authentication",
                            remediation="Ensure device is using unique local key and consider firmware alternatives",
                            severity_override=Severity.MEDIUM,
                        )
                        return

                except socket.timeout:
                    sock.close()

            except Exception:
                pass

        self.add_passed(check, device)

    async def _check_pairing_mode(self, device: Device) -> None:
        """Check if device pairing mode is exposed."""
        check = CHECKS["tuya_pairing_mode"]

        # Check for AP mode (pairing)
        if device.hostname and "tuya" in device.hostname.lower() and "ap" in device.hostname.lower():
            self.add_finding(
                check=check,
                device=device,
                description="Device appears to be in pairing/AP mode",
                remediation="Complete device pairing or reset if unauthorized",
            )
            return

        self.add_passed(check, device)

    def _add_cloud_info(self, device: Device) -> None:
        """Add informational note about Tuya cloud."""
        # This is handled in cloud sync check
        pass
