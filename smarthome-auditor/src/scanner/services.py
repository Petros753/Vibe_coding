"""Service detection module."""

from __future__ import annotations

import asyncio
import ssl
from datetime import datetime
from typing import Any, Optional

import aiohttp

from ..models import Device, Platform


class ServiceDetector:
    """Detects and identifies services running on devices."""

    def __init__(self, timeout: float = 5.0):
        self.timeout = timeout

    async def detect(self, device: Device) -> dict[str, Any]:
        """Detect services on a device."""
        services = {}

        # Run detection tasks in parallel
        tasks = []

        # HTTP/HTTPS detection
        if device.has_port(80) or device.has_port(8080) or device.has_port(8123):
            tasks.append(self._detect_http(device))

        if device.has_port(443) or device.has_port(8443):
            tasks.append(self._detect_https(device))

        # Home Assistant
        if device.has_port(8123):
            tasks.append(self._detect_home_assistant(device))

        # MQTT
        if device.has_port(1883) or device.has_port(8883):
            tasks.append(self._detect_mqtt(device))

        # Tuya
        if device.has_port(6668) or device.has_port(6669):
            tasks.append(self._detect_tuya(device))

        # SSH/Telnet
        if device.has_port(22):
            tasks.append(self._detect_ssh(device))
        if device.has_port(23):
            tasks.append(self._detect_telnet(device))

        # Run all detection tasks
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Merge results
        for result in results:
            if isinstance(result, dict):
                services.update(result)

        return services

    async def _detect_http(self, device: Device) -> dict[str, Any]:
        """Detect HTTP service."""
        ports = [80, 8080, 8123, 8000, 3000]
        result = {"http": {}}

        for port in ports:
            if not device.has_port(port):
                continue

            try:
                url = f"http://{device.ip}:{port}/"
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url,
                        timeout=aiohttp.ClientTimeout(total=self.timeout),
                        allow_redirects=False,
                    ) as response:
                        result["http"][port] = {
                            "status": response.status,
                            "server": response.headers.get("Server"),
                            "content_type": response.headers.get("Content-Type"),
                            "redirect": response.headers.get("Location"),
                        }

                        # Check for common frameworks
                        text = await response.text()
                        if "Home Assistant" in text:
                            result["home_assistant"] = {"port": port, "http": True}
                        if "Tuya" in text or "Smart Life" in text:
                            result["tuya"] = {"port": port}

            except Exception:
                continue

        return result

    async def _detect_https(self, device: Device) -> dict[str, Any]:
        """Detect HTTPS service and check certificate."""
        ports = [443, 8443]
        result = {"https": {}}

        for port in ports:
            if not device.has_port(port):
                continue

            try:
                # Check SSL certificate
                ssl_info = await self._check_ssl_cert(device.ip, port)

                url = f"https://{device.ip}:{port}/"
                connector = aiohttp.TCPConnector(ssl=False)  # Don't verify for detection

                async with aiohttp.ClientSession(connector=connector) as session:
                    async with session.get(
                        url,
                        timeout=aiohttp.ClientTimeout(total=self.timeout),
                        allow_redirects=False,
                    ) as response:
                        result["https"][port] = {
                            "status": response.status,
                            "server": response.headers.get("Server"),
                            "ssl": ssl_info,
                        }

            except Exception:
                continue

        return result

    async def _check_ssl_cert(self, ip: str, port: int) -> dict[str, Any]:
        """Check SSL certificate details."""
        result = {
            "valid": False,
            "self_signed": False,
            "expired": False,
            "issuer": None,
            "expires": None,
        }

        try:
            # Create SSL context that doesn't verify
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE

            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port, ssl=context),
                timeout=self.timeout,
            )

            # Get certificate
            ssl_object = writer.get_extra_info("ssl_object")
            if ssl_object:
                cert = ssl_object.getpeercert(binary_form=True)
                if cert:
                    # Parse certificate using cryptography if available
                    try:
                        from cryptography import x509
                        from cryptography.hazmat.backends import default_backend

                        parsed = x509.load_der_x509_certificate(cert, default_backend())
                        result["issuer"] = parsed.issuer.rfc4514_string()
                        result["expires"] = parsed.not_valid_after_utc.isoformat()
                        result["subject"] = parsed.subject.rfc4514_string()

                        # Check if self-signed
                        result["self_signed"] = parsed.issuer == parsed.subject

                        # Check if expired
                        result["expired"] = parsed.not_valid_after_utc < datetime.now(
                            parsed.not_valid_after_utc.tzinfo
                        )

                        result["valid"] = not result["expired"] and not result["self_signed"]

                    except ImportError:
                        # cryptography not available
                        pass

            writer.close()
            await writer.wait_closed()

        except Exception:
            pass

        return result

    async def _detect_home_assistant(self, device: Device) -> dict[str, Any]:
        """Detect Home Assistant instance."""
        result = {}

        try:
            url = f"http://{device.ip}:8123/api/"
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                ) as response:
                    if response.status in (200, 401):
                        result["home_assistant"] = {
                            "detected": True,
                            "auth_required": response.status == 401,
                            "port": 8123,
                        }

                        # Try to get version
                        try:
                            manifest_url = f"http://{device.ip}:8123/manifest.json"
                            async with session.get(manifest_url) as manifest_resp:
                                if manifest_resp.status == 200:
                                    data = await manifest_resp.json()
                                    result["home_assistant"]["name"] = data.get("name")
                        except Exception:
                            pass

        except Exception:
            pass

        return result

    async def _detect_mqtt(self, device: Device) -> dict[str, Any]:
        """Detect MQTT broker."""
        result = {}
        ports = [(1883, False), (8883, True)]

        for port, use_ssl in ports:
            if not device.has_port(port):
                continue

            try:
                # Try to connect to MQTT broker
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(device.ip, port),
                    timeout=self.timeout,
                )

                # Send MQTT CONNECT packet (minimal)
                connect_packet = bytes([
                    0x10,  # CONNECT
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

                # Read response
                response = await asyncio.wait_for(
                    reader.read(4),
                    timeout=self.timeout,
                )

                writer.close()
                await writer.wait_closed()

                if response and response[0] == 0x20:  # CONNACK
                    return_code = response[3] if len(response) > 3 else -1
                    result["mqtt"] = {
                        "detected": True,
                        "port": port,
                        "tls": use_ssl,
                        "auth_required": return_code == 5,  # Not authorized
                        "anonymous_allowed": return_code == 0,
                    }
                    break

            except Exception:
                continue

        return result

    async def _detect_tuya(self, device: Device) -> dict[str, Any]:
        """Detect Tuya device."""
        result = {}

        # Tuya devices typically respond on port 6668
        if device.has_port(6668):
            result["tuya"] = {
                "detected": True,
                "port": 6668,
                "local_api": True,
            }

        return result

    async def _detect_ssh(self, device: Device) -> dict[str, Any]:
        """Detect SSH service."""
        result = {}

        if device.has_port(22):
            port_info = device.get_port_info(22)
            if port_info and port_info.banner:
                result["ssh"] = {
                    "detected": True,
                    "banner": port_info.banner,
                    "version": self._parse_ssh_version(port_info.banner),
                }
            else:
                result["ssh"] = {"detected": True}

        return result

    async def _detect_telnet(self, device: Device) -> dict[str, Any]:
        """Detect Telnet service."""
        result = {}

        if device.has_port(23):
            result["telnet"] = {
                "detected": True,
                "insecure": True,
            }

        return result

    def _parse_ssh_version(self, banner: str) -> Optional[str]:
        """Parse SSH version from banner."""
        if not banner:
            return None

        # SSH banners typically start with "SSH-"
        if banner.startswith("SSH-"):
            parts = banner.split()
            if parts:
                return parts[0]

        return None
