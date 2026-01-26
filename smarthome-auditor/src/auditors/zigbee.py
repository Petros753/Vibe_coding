"""Zigbee network security auditor."""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from ..models import Device, Platform, Severity, SecurityCheck, AuditResult
from .base import BaseAuditor, register_auditor


CHECKS = {
    "zigbee_default_key": SecurityCheck(
        id="zigbee-001",
        name="Default Trust Center Key",
        description="Zigbee network may be using default trust center link key",
        category="encryption",
        severity_if_failed=Severity.CRITICAL,
    ),
    "zigbee_permit_join": SecurityCheck(
        id="zigbee-002",
        name="Open Pairing Mode",
        description="Zigbee network has permit join enabled",
        category="authentication",
        severity_if_failed=Severity.HIGH,
    ),
    "zigbee_insecure_rejoin": SecurityCheck(
        id="zigbee-003",
        name="Insecure Rejoin Enabled",
        description="Network allows insecure rejoin which can be exploited",
        category="authentication",
        severity_if_failed=Severity.MEDIUM,
    ),
    "zigbee_old_devices": SecurityCheck(
        id="zigbee-004",
        name="Legacy Devices Present",
        description="Network has devices without proper encryption support",
        category="encryption",
        severity_if_failed=Severity.MEDIUM,
    ),
    "zigbee_coordinator_exposed": SecurityCheck(
        id="zigbee-005",
        name="Coordinator Web Interface",
        description="Zigbee coordinator has exposed web interface",
        category="network",
        severity_if_failed=Severity.MEDIUM,
    ),
    "zigbee_network_key_static": SecurityCheck(
        id="zigbee-006",
        name="Static Network Key",
        description="Network key is static and never rotated",
        category="encryption",
        severity_if_failed=Severity.LOW,
    ),
}

# Well-known default Zigbee keys
DEFAULT_ZIGBEE_KEYS = [
    "5A:69:67:42:65:65:41:6C:6C:69:61:6E:63:65:30:39",  # ZigBeeAlliance09
    "00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00",  # All zeros
]


@register_auditor
class ZigbeeAuditor(BaseAuditor):
    """Security auditor for Zigbee networks and coordinators."""

    @property
    def name(self) -> str:
        return "Zigbee Network Auditor"

    @property
    def description(self) -> str:
        return "Security checks for Zigbee network configuration and coordinators"

    @property
    def checks(self) -> list[SecurityCheck]:
        return list(CHECKS.values())

    async def detect(self, device: Device) -> bool:
        """Detect if device is a Zigbee coordinator/bridge."""
        # Check platform
        if device.platform == Platform.ZIGBEE:
            return True

        # Check hostname patterns
        if device.hostname:
            zigbee_patterns = ["zigbee", "zbbridge", "conbee", "cc2531", "sonoff"]
            if any(p in device.hostname.lower() for p in zigbee_patterns):
                return True

        # Check for zigbee2mqtt or similar
        if "zigbee" in device.services:
            return True

        # Check vendor
        if device.vendor and "dresden" in device.vendor.lower():
            return True  # ConBee

        return False

    async def audit(self, device: Device) -> AuditResult:
        """Perform Zigbee network security audit."""
        self._reset()
        start_time = datetime.now()

        # Run checks
        await asyncio.gather(
            self._check_coordinator_interface(device),
            self._check_default_key_warning(device),
            self._check_permit_join_warning(device),
            return_exceptions=True,
        )

        return self._create_result(device, start_time)

    async def _check_coordinator_interface(self, device: Device) -> None:
        """Check if coordinator has exposed web interface."""
        check = CHECKS["zigbee_coordinator_exposed"]

        http_ports = [80, 8080, 8081]

        for port in http_ports:
            if device.has_port(port):
                self.add_finding(
                    check=check,
                    device=device,
                    description=f"Zigbee coordinator has web interface on port {port}",
                    remediation="Ensure web interface requires authentication",
                    evidence=f"Port {port} is open",
                    severity_override=Severity.LOW,
                )
                return

        self.add_passed(check, device)

    async def _check_default_key_warning(self, device: Device) -> None:
        """Warn about default trust center key."""
        check = CHECKS["zigbee_default_key"]

        # We can't actually check the key without sniffing
        # So we provide a warning/recommendation
        self.add_finding(
            check=check,
            device=device,
            description="Verify that Zigbee network is not using default trust center key (ZigBeeAlliance09)",
            remediation="Configure a unique network key in your Zigbee coordinator",
            references=[
                "https://www.zigbee2mqtt.io/guide/configuration/",
                "https://www.blackhillsinfosec.com/zigbee-hacking-101/",
            ],
            severity_override=Severity.INFO,
        )

    async def _check_permit_join_warning(self, device: Device) -> None:
        """Warn about permit join."""
        check = CHECKS["zigbee_permit_join"]

        # We recommend checking permit join status
        self.add_finding(
            check=check,
            device=device,
            description="Verify that permit_join is disabled when not pairing devices",
            remediation="Disable permit_join after adding new devices to prevent unauthorized joining",
            references=[
                "https://www.zigbee2mqtt.io/guide/usage/pairing_devices.html",
            ],
            severity_override=Severity.INFO,
        )
