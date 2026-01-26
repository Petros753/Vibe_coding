"""Generic security auditor for common checks."""

from __future__ import annotations

import asyncio
import ssl
from datetime import datetime
from typing import Any, Optional

import aiohttp

from ..models import (
    Device,
    Finding,
    Severity,
    SecurityCheck,
    AuditResult,
    DEFAULT_CREDENTIALS,
)
from .base import BaseAuditor, register_auditor


# Define security checks
CHECKS = {
    "http_no_auth": SecurityCheck(
        id="generic-001",
        name="HTTP Without Authentication",
        description="Web interface accessible without authentication",
        category="authentication",
        severity_if_failed=Severity.HIGH,
    ),
    "http_no_https": SecurityCheck(
        id="generic-002",
        name="HTTP Instead of HTTPS",
        description="Unencrypted HTTP connection available",
        category="encryption",
        severity_if_failed=Severity.MEDIUM,
    ),
    "ssl_self_signed": SecurityCheck(
        id="generic-003",
        name="Self-Signed Certificate",
        description="SSL certificate is self-signed",
        category="encryption",
        severity_if_failed=Severity.LOW,
    ),
    "ssl_expired": SecurityCheck(
        id="generic-004",
        name="Expired SSL Certificate",
        description="SSL certificate has expired",
        category="encryption",
        severity_if_failed=Severity.MEDIUM,
    ),
    "default_credentials": SecurityCheck(
        id="generic-005",
        name="Default Credentials",
        description="Device uses default username/password",
        category="authentication",
        severity_if_failed=Severity.CRITICAL,
    ),
    "telnet_enabled": SecurityCheck(
        id="generic-006",
        name="Telnet Enabled",
        description="Insecure Telnet service is running",
        category="network",
        severity_if_failed=Severity.HIGH,
    ),
    "ssh_weak_auth": SecurityCheck(
        id="generic-007",
        name="SSH Weak Authentication",
        description="SSH allows password authentication or has weak settings",
        category="authentication",
        severity_if_failed=Severity.MEDIUM,
    ),
    "upnp_enabled": SecurityCheck(
        id="generic-008",
        name="UPnP Enabled",
        description="UPnP service is running, may allow port forwarding",
        category="network",
        severity_if_failed=Severity.MEDIUM,
    ),
    "open_ports": SecurityCheck(
        id="generic-009",
        name="Unnecessary Open Ports",
        description="Device has many open ports that may not be needed",
        category="network",
        severity_if_failed=Severity.LOW,
    ),
    "verbose_errors": SecurityCheck(
        id="generic-010",
        name="Verbose Error Messages",
        description="Service exposes detailed error information",
        category="information_disclosure",
        severity_if_failed=Severity.LOW,
    ),
    "cors_misconfigured": SecurityCheck(
        id="generic-011",
        name="CORS Misconfiguration",
        description="Cross-Origin Resource Sharing is too permissive",
        category="web_security",
        severity_if_failed=Severity.MEDIUM,
    ),
    "no_rate_limiting": SecurityCheck(
        id="generic-012",
        name="No Rate Limiting",
        description="API endpoints have no rate limiting",
        category="web_security",
        severity_if_failed=Severity.LOW,
    ),
}


@register_auditor
class GenericAuditor(BaseAuditor):
    """Generic security auditor for common checks across all devices."""

    @property
    def name(self) -> str:
        return "Generic Security Auditor"

    @property
    def description(self) -> str:
        return "Performs common security checks applicable to most devices"

    @property
    def checks(self) -> list[SecurityCheck]:
        return list(CHECKS.values())

    async def detect(self, device: Device) -> bool:
        """Generic auditor applies to all devices."""
        return True

    async def audit(self, device: Device) -> AuditResult:
        """Perform generic security audit."""
        self._reset()
        start_time = datetime.now()

        # Run all checks
        await asyncio.gather(
            self._check_http_auth(device),
            self._check_https(device),
            self._check_ssl_cert(device),
            self._check_default_credentials(device),
            self._check_telnet(device),
            self._check_ssh(device),
            self._check_upnp(device),
            self._check_open_ports(device),
            self._check_cors(device),
            return_exceptions=True,
        )

        return self._create_result(device, start_time)

    async def _check_http_auth(self, device: Device) -> None:
        """Check if HTTP requires authentication."""
        check = CHECKS["http_no_auth"]
        http_ports = [80, 8080, 8000, 3000]

        for port in http_ports:
            if not device.has_port(port):
                continue

            try:
                url = f"http://{device.ip}:{port}/"
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        url,
                        timeout=aiohttp.ClientTimeout(total=5),
                        allow_redirects=True,
                    ) as response:
                        if response.status == 200:
                            # Check if it's a login page or actual content
                            text = await response.text()
                            if not self._is_login_page(text):
                                self.add_finding(
                                    check=check,
                                    device=device,
                                    description=f"HTTP interface on port {port} is accessible without authentication",
                                    remediation="Enable authentication for the web interface",
                                    evidence=f"GET {url} returned 200 OK without credentials",
                                )
                                return

            except Exception:
                continue

        self.add_passed(check, device)

    async def _check_https(self, device: Device) -> None:
        """Check if HTTPS is available when HTTP is."""
        check = CHECKS["http_no_https"]

        # If HTTP is open but not HTTPS
        has_http = device.has_port(80) or device.has_port(8080)
        has_https = device.has_port(443) or device.has_port(8443)

        if has_http and not has_https:
            self.add_finding(
                check=check,
                device=device,
                description="Device only supports unencrypted HTTP connection",
                remediation="Enable HTTPS and redirect HTTP to HTTPS",
            )
        else:
            self.add_passed(check, device)

    async def _check_ssl_cert(self, device: Device) -> None:
        """Check SSL certificate validity."""
        https_ports = [443, 8443, 8123]

        for port in https_ports:
            if not device.has_port(port):
                continue

            try:
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE

                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(device.ip, port, ssl=context),
                    timeout=5,
                )

                ssl_object = writer.get_extra_info("ssl_object")
                if ssl_object:
                    cert = ssl_object.getpeercert(binary_form=True)
                    if cert:
                        await self._analyze_cert(device, cert, port)

                writer.close()
                await writer.wait_closed()
                return

            except Exception:
                continue

        # No HTTPS to check
        self.add_passed(CHECKS["ssl_self_signed"], device)
        self.add_passed(CHECKS["ssl_expired"], device)

    async def _analyze_cert(self, device: Device, cert_der: bytes, port: int) -> None:
        """Analyze SSL certificate."""
        try:
            from cryptography import x509
            from cryptography.hazmat.backends import default_backend
            from datetime import timezone

            cert = x509.load_der_x509_certificate(cert_der, default_backend())

            # Check if self-signed
            if cert.issuer == cert.subject:
                self.add_finding(
                    check=CHECKS["ssl_self_signed"],
                    device=device,
                    description=f"SSL certificate on port {port} is self-signed",
                    remediation="Use a certificate from a trusted CA or Let's Encrypt",
                    evidence=f"Issuer: {cert.issuer.rfc4514_string()}",
                    severity_override=Severity.LOW,
                )
            else:
                self.add_passed(CHECKS["ssl_self_signed"], device)

            # Check if expired
            now = datetime.now(timezone.utc)
            if cert.not_valid_after_utc < now:
                self.add_finding(
                    check=CHECKS["ssl_expired"],
                    device=device,
                    description=f"SSL certificate on port {port} has expired",
                    remediation="Renew the SSL certificate",
                    evidence=f"Expired: {cert.not_valid_after_utc.isoformat()}",
                )
            else:
                self.add_passed(CHECKS["ssl_expired"], device)

        except ImportError:
            self.skip_check(CHECKS["ssl_self_signed"], "cryptography library not available")
            self.skip_check(CHECKS["ssl_expired"], "cryptography library not available")

    async def _check_default_credentials(self, device: Device) -> None:
        """Check for default credentials."""
        check = CHECKS["default_credentials"]

        # Check HTTP basic auth endpoints
        auth_endpoints = [
            (80, "/"),
            (8080, "/"),
            (443, "/"),
            (8443, "/"),
        ]

        for port, path in auth_endpoints:
            if not device.has_port(port):
                continue

            scheme = "https" if port in (443, 8443) else "http"

            for username, password, device_types in DEFAULT_CREDENTIALS:
                try:
                    url = f"{scheme}://{device.ip}:{port}{path}"
                    auth = aiohttp.BasicAuth(username, password)

                    connector = aiohttp.TCPConnector(ssl=False)
                    async with aiohttp.ClientSession(connector=connector) as session:
                        async with session.get(
                            url,
                            auth=auth,
                            timeout=aiohttp.ClientTimeout(total=3),
                            allow_redirects=True,
                        ) as response:
                            if response.status == 200:
                                # Verify it's not a login page
                                text = await response.text()
                                if not self._is_login_page(text):
                                    self.add_finding(
                                        check=check,
                                        device=device,
                                        description=f"Device accepts default credentials",
                                        remediation="Change the default username and password immediately",
                                        # Don't log actual credentials
                                        evidence=f"Default credentials work on port {port}",
                                    )
                                    return

                except Exception:
                    continue

        self.add_passed(check, device)

    async def _check_telnet(self, device: Device) -> None:
        """Check if Telnet is enabled."""
        check = CHECKS["telnet_enabled"]

        if device.has_port(23):
            self.add_finding(
                check=check,
                device=device,
                description="Telnet service is running on port 23",
                remediation="Disable Telnet and use SSH instead for remote access",
                references=["https://owasp.org/www-project-iot-top-10/"],
            )
        else:
            self.add_passed(check, device)

    async def _check_ssh(self, device: Device) -> None:
        """Check SSH configuration."""
        check = CHECKS["ssh_weak_auth"]

        if not device.has_port(22):
            self.add_passed(check, device)
            return

        port_info = device.get_port_info(22)
        if port_info and port_info.banner:
            # Check for old SSH versions
            banner = port_info.banner.lower()
            if "ssh-1" in banner:
                self.add_finding(
                    check=check,
                    device=device,
                    description="SSH version 1 is enabled (insecure)",
                    remediation="Upgrade to SSH version 2 only",
                    evidence=port_info.banner,
                )
                return

        # Basic SSH is fine
        self.add_passed(check, device)

    async def _check_upnp(self, device: Device) -> None:
        """Check if UPnP is enabled."""
        check = CHECKS["upnp_enabled"]

        if device.has_port(1900) or device.has_port(49152):
            self.add_finding(
                check=check,
                device=device,
                description="UPnP service is running",
                remediation="Disable UPnP if not needed, or restrict to local network only",
                references=["https://www.kb.cert.org/vuls/id/357851"],
            )
        else:
            self.add_passed(check, device)

    async def _check_open_ports(self, device: Device) -> None:
        """Check for excessive open ports."""
        check = CHECKS["open_ports"]

        # More than 10 open ports is suspicious
        if len(device.open_ports) > 10:
            ports_str = ", ".join(str(p.port) for p in device.open_ports[:10])
            self.add_finding(
                check=check,
                device=device,
                description=f"Device has {len(device.open_ports)} open ports",
                remediation="Review open ports and close unnecessary services",
                evidence=f"Open ports include: {ports_str}...",
            )
        else:
            self.add_passed(check, device)

    async def _check_cors(self, device: Device) -> None:
        """Check CORS configuration."""
        check = CHECKS["cors_misconfigured"]
        http_ports = [80, 443, 8080, 8443, 8123]

        for port in http_ports:
            if not device.has_port(port):
                continue

            scheme = "https" if port in (443, 8443) else "http"

            try:
                url = f"{scheme}://{device.ip}:{port}/"
                headers = {"Origin": "http://evil.com"}

                connector = aiohttp.TCPConnector(ssl=False)
                async with aiohttp.ClientSession(connector=connector) as session:
                    async with session.get(
                        url,
                        headers=headers,
                        timeout=aiohttp.ClientTimeout(total=5),
                    ) as response:
                        cors_header = response.headers.get("Access-Control-Allow-Origin", "")

                        if cors_header == "*":
                            self.add_finding(
                                check=check,
                                device=device,
                                description=f"CORS allows any origin on port {port}",
                                remediation="Restrict CORS to specific trusted origins",
                                evidence=f"Access-Control-Allow-Origin: {cors_header}",
                            )
                            return

            except Exception:
                continue

        self.add_passed(check, device)

    def _is_login_page(self, html: str) -> bool:
        """Check if HTML appears to be a login page."""
        html_lower = html.lower()
        login_indicators = [
            "login", "sign in", "authenticate",
            'type="password"', "password field",
            "username", "enter your credentials",
        ]
        return any(indicator in html_lower for indicator in login_indicators)
