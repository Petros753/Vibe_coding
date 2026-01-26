"""MQTT broker security auditor."""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

from ..models import Device, Platform, Severity, SecurityCheck, AuditResult
from .base import BaseAuditor, register_auditor


CHECKS = {
    "mqtt_no_auth": SecurityCheck(
        id="mqtt-001",
        name="MQTT Anonymous Access",
        description="MQTT broker allows anonymous connections",
        category="authentication",
        severity_if_failed=Severity.CRITICAL,
    ),
    "mqtt_no_tls": SecurityCheck(
        id="mqtt-002",
        name="MQTT Without TLS",
        description="MQTT broker accepts unencrypted connections",
        category="encryption",
        severity_if_failed=Severity.HIGH,
    ),
    "mqtt_wildcard_subscribe": SecurityCheck(
        id="mqtt-003",
        name="Wildcard Subscribe Allowed",
        description="Anonymous users can subscribe to all topics",
        category="authorization",
        severity_if_failed=Severity.HIGH,
    ),
    "mqtt_sys_topic_exposed": SecurityCheck(
        id="mqtt-004",
        name="$SYS Topics Exposed",
        description="MQTT system topics are accessible",
        category="information_disclosure",
        severity_if_failed=Severity.MEDIUM,
    ),
    "mqtt_weak_acl": SecurityCheck(
        id="mqtt-005",
        name="Weak ACL Configuration",
        description="MQTT broker has overly permissive access control",
        category="authorization",
        severity_if_failed=Severity.MEDIUM,
    ),
    "mqtt_websocket_exposed": SecurityCheck(
        id="mqtt-006",
        name="MQTT WebSocket Exposed",
        description="MQTT over WebSocket is accessible",
        category="network",
        severity_if_failed=Severity.LOW,
    ),
    "mqtt_default_port": SecurityCheck(
        id="mqtt-007",
        name="Default MQTT Port",
        description="MQTT running on default port 1883",
        category="network",
        severity_if_failed=Severity.INFO,
    ),
}


@register_auditor
class MQTTAuditor(BaseAuditor):
    """Security auditor for MQTT brokers."""

    @property
    def name(self) -> str:
        return "MQTT Broker Auditor"

    @property
    def description(self) -> str:
        return "Security checks for MQTT brokers commonly used in smart home setups"

    @property
    def checks(self) -> list[SecurityCheck]:
        return list(CHECKS.values())

    async def detect(self, device: Device) -> bool:
        """Detect if device is running MQTT broker."""
        # Check platform
        if device.platform == Platform.MQTT:
            return True

        # Check for MQTT ports
        if device.has_port(1883) or device.has_port(8883):
            return True

        # Check for WebSocket MQTT ports
        if device.has_port(9001):
            return True

        # Check services
        if "mqtt" in device.services:
            return True

        return False

    async def audit(self, device: Device) -> AuditResult:
        """Perform MQTT broker security audit."""
        self._reset()
        start_time = datetime.now()

        # Run checks
        await asyncio.gather(
            self._check_anonymous_access(device),
            self._check_tls(device),
            self._check_wildcard_subscribe(device),
            self._check_sys_topics(device),
            self._check_websocket(device),
            return_exceptions=True,
        )

        return self._create_result(device, start_time)

    async def _check_anonymous_access(self, device: Device) -> None:
        """Check if MQTT allows anonymous access."""
        check = CHECKS["mqtt_no_auth"]

        if not device.has_port(1883):
            self.add_passed(check, device)
            return

        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(device.ip, 1883),
                timeout=5,
            )

            # MQTT CONNECT packet (anonymous)
            connect_packet = bytes([
                0x10,  # CONNECT packet type
                0x10,  # Remaining length
                0x00, 0x04,  # Protocol name length
                0x4D, 0x51, 0x54, 0x54,  # "MQTT"
                0x04,  # Protocol level (4 = 3.1.1)
                0x02,  # Connect flags (clean session)
                0x00, 0x3C,  # Keep alive (60s)
                0x00, 0x04,  # Client ID length
                0x74, 0x65, 0x73, 0x74,  # "test"
            ])

            writer.write(connect_packet)
            await writer.drain()

            # Read CONNACK
            response = await asyncio.wait_for(reader.read(4), timeout=5)

            writer.close()
            await writer.wait_closed()

            if response and len(response) >= 4:
                if response[0] == 0x20:  # CONNACK
                    return_code = response[3]
                    if return_code == 0:  # Connection accepted
                        self.add_finding(
                            check=check,
                            device=device,
                            description="MQTT broker accepts anonymous connections",
                            remediation="Enable authentication in MQTT broker configuration",
                            evidence="CONNACK return code 0 (Connection Accepted) without credentials",
                            references=[
                                "https://mosquitto.org/documentation/authentication-methods/",
                            ],
                        )
                        return
                    elif return_code == 5:  # Not authorized
                        self.add_passed(check, device)
                        return

        except Exception:
            pass

        self.add_passed(check, device)

    async def _check_tls(self, device: Device) -> None:
        """Check if MQTT uses TLS."""
        check = CHECKS["mqtt_no_tls"]

        has_mqtt = device.has_port(1883)
        has_mqtts = device.has_port(8883)

        if has_mqtt and not has_mqtts:
            self.add_finding(
                check=check,
                device=device,
                description="MQTT broker only accepts unencrypted connections",
                remediation="Enable TLS/SSL on the MQTT broker (port 8883)",
                references=[
                    "https://mosquitto.org/man/mosquitto-tls-7.html",
                ],
            )
        else:
            self.add_passed(check, device)

    async def _check_wildcard_subscribe(self, device: Device) -> None:
        """Check if wildcard subscribe is allowed."""
        check = CHECKS["mqtt_wildcard_subscribe"]

        if not device.has_port(1883):
            self.add_passed(check, device)
            return

        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(device.ip, 1883),
                timeout=5,
            )

            # CONNECT first
            connect_packet = bytes([
                0x10, 0x10,
                0x00, 0x04, 0x4D, 0x51, 0x54, 0x54,
                0x04, 0x02, 0x00, 0x3C,
                0x00, 0x04, 0x74, 0x65, 0x73, 0x74,
            ])

            writer.write(connect_packet)
            await writer.drain()

            # Read CONNACK
            response = await asyncio.wait_for(reader.read(4), timeout=5)

            if response and len(response) >= 4 and response[0] == 0x20 and response[3] == 0:
                # Connected, try wildcard subscribe
                subscribe_packet = bytes([
                    0x82,  # SUBSCRIBE
                    0x05,  # Remaining length
                    0x00, 0x01,  # Packet ID
                    0x00, 0x01,  # Topic filter length
                    0x23,  # "#" (wildcard)
                    0x00,  # QoS 0
                ])

                writer.write(subscribe_packet)
                await writer.drain()

                # Read SUBACK
                suback = await asyncio.wait_for(reader.read(5), timeout=5)

                if suback and len(suback) >= 5 and suback[0] == 0x90:
                    return_code = suback[4]
                    if return_code < 0x80:  # Success
                        self.add_finding(
                            check=check,
                            device=device,
                            description="MQTT broker allows subscribing to wildcard topic '#'",
                            remediation="Configure ACLs to restrict topic access",
                            evidence="SUBACK accepted wildcard subscription",
                        )
                        writer.close()
                        await writer.wait_closed()
                        return

            writer.close()
            await writer.wait_closed()

        except Exception:
            pass

        self.add_passed(check, device)

    async def _check_sys_topics(self, device: Device) -> None:
        """Check if $SYS topics are accessible."""
        check = CHECKS["mqtt_sys_topic_exposed"]

        if not device.has_port(1883):
            self.add_passed(check, device)
            return

        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(device.ip, 1883),
                timeout=5,
            )

            # CONNECT
            connect_packet = bytes([
                0x10, 0x10,
                0x00, 0x04, 0x4D, 0x51, 0x54, 0x54,
                0x04, 0x02, 0x00, 0x3C,
                0x00, 0x04, 0x74, 0x65, 0x73, 0x74,
            ])

            writer.write(connect_packet)
            await writer.drain()

            response = await asyncio.wait_for(reader.read(4), timeout=5)

            if response and len(response) >= 4 and response[0] == 0x20 and response[3] == 0:
                # Try to subscribe to $SYS/#
                subscribe_packet = bytes([
                    0x82,  # SUBSCRIBE
                    0x0B,  # Remaining length
                    0x00, 0x01,  # Packet ID
                    0x00, 0x06,  # Topic filter length
                    0x24, 0x53, 0x59, 0x53, 0x2F, 0x23,  # "$SYS/#"
                    0x00,  # QoS 0
                ])

                writer.write(subscribe_packet)
                await writer.drain()

                suback = await asyncio.wait_for(reader.read(5), timeout=5)

                if suback and len(suback) >= 5 and suback[0] == 0x90:
                    return_code = suback[4]
                    if return_code < 0x80:
                        self.add_finding(
                            check=check,
                            device=device,
                            description="MQTT $SYS topics are accessible",
                            remediation="Restrict access to $SYS topics via ACLs",
                            evidence="Subscribed to $SYS/# successfully",
                        )
                        writer.close()
                        await writer.wait_closed()
                        return

            writer.close()
            await writer.wait_closed()

        except Exception:
            pass

        self.add_passed(check, device)

    async def _check_websocket(self, device: Device) -> None:
        """Check for MQTT over WebSocket."""
        check = CHECKS["mqtt_websocket_exposed"]

        ws_ports = [9001, 8080, 80]

        for port in ws_ports:
            if device.has_port(port):
                self.add_finding(
                    check=check,
                    device=device,
                    description=f"Potential MQTT WebSocket endpoint on port {port}",
                    remediation="Ensure WebSocket MQTT requires authentication and uses TLS",
                    evidence=f"Port {port} is open",
                    severity_override=Severity.INFO,
                )
                return

        self.add_passed(check, device)
