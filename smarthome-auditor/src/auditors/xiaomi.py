"""Xiaomi Mi Home device security auditor."""

from __future__ import annotations

import asyncio
import socket
import struct
from datetime import datetime
from typing import Any

from ..models import Device, Platform, Severity, SecurityCheck, AuditResult
from .base import BaseAuditor, register_auditor


CHECKS = {
    "xiaomi_local_api": SecurityCheck(
        id="xiaomi-001",
        name="Xiaomi Local API Exposed",
        description="Xiaomi miio local API is accessible",
        category="network",
        severity_if_failed=Severity.LOW,
    ),
    "xiaomi_cloud_sync": SecurityCheck(
        id="xiaomi-002",
        name="Cloud Sync to China",
        description="Device syncs data to Xiaomi cloud servers",
        category="privacy",
        severity_if_failed=Severity.MEDIUM,
    ),
    "xiaomi_token_exposed": SecurityCheck(
        id="xiaomi-003",
        name="Device Token Accessible",
        description="Device token may be extractable",
        category="authentication",
        severity_if_failed=Severity.MEDIUM,
    ),
    "xiaomi_firmware_old": SecurityCheck(
        id="xiaomi-004",
        name="Outdated Firmware",
        description="Device firmware is outdated",
        category="version",
        severity_if_failed=Severity.MEDIUM,
    ),
    "xiaomi_gateway_exposed": SecurityCheck(
        id="xiaomi-005",
        name="Gateway Exposed",
        description="Xiaomi gateway is accessible without proper authentication",
        category="authentication",
        severity_if_failed=Severity.HIGH,
    ),
    "xiaomi_multicast": SecurityCheck(
        id="xiaomi-006",
        name="Multicast Discovery Enabled",
        description="Device responds to multicast discovery",
        category="information_disclosure",
        severity_if_failed=Severity.LOW,
    ),
}


@register_auditor
class XiaomiAuditor(BaseAuditor):
    """Security auditor for Xiaomi Mi Home devices."""

    @property
    def name(self) -> str:
        return "Xiaomi Mi Home Auditor"

    @property
    def description(self) -> str:
        return "Security checks for Xiaomi Mi Home smart devices and gateways"

    @property
    def checks(self) -> list[SecurityCheck]:
        return list(CHECKS.values())

    async def detect(self, device: Device) -> bool:
        """Detect if device is a Xiaomi device."""
        # Check platform
        if device.platform == Platform.XIAOMI:
            return True

        # Check vendor
        if device.vendor and "xiaomi" in device.vendor.lower():
            return True

        # Check for miio port
        if device.has_port(54321):
            return True

        return False

    async def audit(self, device: Device) -> AuditResult:
        """Perform Xiaomi device security audit."""
        self._reset()
        start_time = datetime.now()

        # Run checks
        await asyncio.gather(
            self._check_local_api(device),
            self._check_cloud_sync(device),
            self._check_gateway(device),
            self._check_multicast(device),
            return_exceptions=True,
        )

        return self._create_result(device, start_time)

    async def _check_local_api(self, device: Device) -> None:
        """Check Xiaomi miio local API."""
        check = CHECKS["xiaomi_local_api"]

        if not device.has_port(54321):
            self.add_passed(check, device)
            return

        try:
            # Try to send miio hello packet
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(3)

            # miio hello packet (magic + length + zeros for discovery)
            hello = bytes([0x21, 0x31]) + bytes(30)

            sock.sendto(hello, (device.ip, 54321))

            try:
                response, _ = sock.recvfrom(1024)
                sock.close()

                if response and len(response) >= 32:
                    # Device responded to discovery
                    self.add_finding(
                        check=check,
                        device=device,
                        description="Xiaomi miio API responds to discovery packets",
                        remediation="This is normal for local control but be aware data can be sniffed",
                        evidence="Device responded to miio hello packet",
                        severity_override=Severity.INFO,
                    )
                    return

            except socket.timeout:
                sock.close()

        except Exception:
            pass

        self.add_passed(check, device)

    async def _check_cloud_sync(self, device: Device) -> None:
        """Check for cloud synchronization."""
        check = CHECKS["xiaomi_cloud_sync"]

        # Xiaomi devices sync to cloud by default
        if device.platform == Platform.XIAOMI or device.has_port(54321):
            self.add_finding(
                check=check,
                device=device,
                description="Device likely syncs data to Xiaomi cloud servers",
                remediation="Consider blocking cloud access via firewall if local-only operation is desired",
                references=[
                    "https://python-miio.readthedocs.io/",
                    "https://github.com/rytilahti/python-miio",
                ],
                severity_override=Severity.INFO,
            )
        else:
            self.add_passed(check, device)

    async def _check_gateway(self, device: Device) -> None:
        """Check Xiaomi gateway security."""
        check = CHECKS["xiaomi_gateway_exposed"]

        # Check for gateway port (usually 9898 for Aqara)
        gateway_ports = [9898, 4321]

        for port in gateway_ports:
            if device.has_port(port):
                try:
                    # Try UDP probe for gateway
                    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    sock.settimeout(3)

                    # Gateway discovery packet
                    discovery = b'{"cmd":"whois"}'
                    sock.sendto(discovery, (device.ip, port))

                    try:
                        response, _ = sock.recvfrom(1024)
                        sock.close()

                        if response and b"iam" in response:
                            self.add_finding(
                                check=check,
                                device=device,
                                description=f"Xiaomi gateway responds to discovery on port {port}",
                                remediation="Ensure gateway password is set and not default",
                                evidence=f"Gateway responded to whois command",
                            )
                            return

                    except socket.timeout:
                        sock.close()

                except Exception:
                    pass

        self.add_passed(check, device)

    async def _check_multicast(self, device: Device) -> None:
        """Check multicast discovery."""
        check = CHECKS["xiaomi_multicast"]

        # This is informational - Xiaomi devices use multicast
        if device.platform == Platform.XIAOMI:
            self.add_finding(
                check=check,
                device=device,
                description="Xiaomi devices use multicast for discovery",
                remediation="This is normal behavior for local network discovery",
                severity_override=Severity.INFO,
            )
        else:
            self.add_passed(check, device)
