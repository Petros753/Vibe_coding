"""Local vulnerability database for smart home devices."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from ..models import Severity, Platform


class KnownVulnerability(BaseModel):
    """A known vulnerability entry."""

    id: str
    platform: Platform
    name: str
    description: str
    severity: Severity
    cve: Optional[str] = None
    affected_versions: Optional[str] = None  # e.g., "<2023.1.0" or "1.0.0-2.0.0"
    fixed_version: Optional[str] = None
    references: list[str] = Field(default_factory=list)
    published_date: Optional[str] = None
    remediation: str = ""


# Built-in vulnerability database
VULNERABILITY_DATABASE: list[KnownVulnerability] = [
    # Home Assistant vulnerabilities
    KnownVulnerability(
        id="HA-2023-001",
        platform=Platform.HOME_ASSISTANT,
        name="Authentication Bypass in Supervisor",
        description="An authentication bypass vulnerability exists in Home Assistant Supervisor API",
        severity=Severity.HIGH,
        cve="CVE-2023-27482",
        affected_versions="<2023.3.0",
        fixed_version="2023.3.0",
        references=["https://www.cvedetails.com/cve/CVE-2023-27482/"],
        remediation="Update Home Assistant to version 2023.3.0 or later",
    ),
    KnownVulnerability(
        id="HA-2023-002",
        platform=Platform.HOME_ASSISTANT,
        name="SSRF in Media Browser",
        description="Server-side request forgery vulnerability in media browser component",
        severity=Severity.MEDIUM,
        affected_versions="<2023.1.0",
        fixed_version="2023.1.0",
        references=["https://www.home-assistant.io/blog/2023/01/"],
        remediation="Update Home Assistant to version 2023.1.0 or later",
    ),
    KnownVulnerability(
        id="HA-2022-001",
        platform=Platform.HOME_ASSISTANT,
        name="Insecure Webhook Configuration",
        description="Webhooks could be triggered without proper validation",
        severity=Severity.MEDIUM,
        affected_versions="<2022.12.0",
        fixed_version="2022.12.0",
        remediation="Update Home Assistant and review webhook configurations",
    ),

    # Tuya vulnerabilities
    KnownVulnerability(
        id="TUYA-2021-001",
        platform=Platform.TUYA,
        name="Hardcoded Encryption Keys",
        description="Some Tuya devices use hardcoded encryption keys that can be extracted",
        severity=Severity.HIGH,
        references=["https://github.com/codetheweb/tuyapi/issues"],
        remediation="Use local key rotation and consider alternative firmware like Tasmota",
    ),
    KnownVulnerability(
        id="TUYA-2020-001",
        platform=Platform.TUYA,
        name="Cloud API Token Leakage",
        description="API tokens can be extracted from mobile app traffic",
        severity=Severity.MEDIUM,
        references=["https://blog.sucuri.net/2020/07/smart-home-vulnerabilities.html"],
        remediation="Use local control only and block cloud access if possible",
    ),

    # Xiaomi vulnerabilities
    KnownVulnerability(
        id="XIAOMI-2020-001",
        platform=Platform.XIAOMI,
        name="Token Extraction via ADB",
        description="Device tokens can be extracted from Xiaomi Home app via ADB backup",
        severity=Severity.MEDIUM,
        references=["https://python-miio.readthedocs.io/en/latest/discovery.html"],
        remediation="Use device binding and consider token rotation",
    ),
    KnownVulnerability(
        id="XIAOMI-2019-001",
        platform=Platform.XIAOMI,
        name="Gateway Password Bypass",
        description="Older Xiaomi gateways have weak password protection",
        severity=Severity.HIGH,
        affected_versions="<1.4.6",
        remediation="Update gateway firmware and set strong password",
    ),

    # Zigbee vulnerabilities
    KnownVulnerability(
        id="ZIGBEE-2020-001",
        platform=Platform.ZIGBEE,
        name="Default Trust Center Key (ZigBeeAlliance09)",
        description="Many Zigbee networks use the well-known default trust center key",
        severity=Severity.CRITICAL,
        references=["https://www.blackhillsinfosec.com/zigbee-hacking-101/"],
        remediation="Configure unique network key and install-codes for device joining",
    ),
    KnownVulnerability(
        id="ZIGBEE-2019-001",
        platform=Platform.ZIGBEE,
        name="Touchlink Commissioning Vulnerabilities",
        description="Zigbee Touchlink can be exploited to steal devices",
        severity=Severity.HIGH,
        references=["https://www.rsaconference.com/library/presentation/"],
        remediation="Disable Touchlink commissioning if not needed",
    ),

    # MQTT vulnerabilities
    KnownVulnerability(
        id="MQTT-2021-001",
        platform=Platform.MQTT,
        name="Mosquitto Authentication Bypass",
        description="Certain Mosquitto versions have authentication bypass issues",
        severity=Severity.HIGH,
        cve="CVE-2021-28166",
        affected_versions="<2.0.10",
        fixed_version="2.0.10",
        references=["https://mosquitto.org/blog/2021/04/version-2-0-10-released/"],
        remediation="Update Mosquitto to version 2.0.10 or later",
    ),
    KnownVulnerability(
        id="MQTT-2020-001",
        platform=Platform.MQTT,
        name="MQTT Broker Memory Exhaustion",
        description="Unauthenticated clients can cause memory exhaustion",
        severity=Severity.MEDIUM,
        references=["https://www.cvedetails.com/vulnerability-list/vendor_id-15608/"],
        remediation="Enable authentication and configure connection limits",
    ),

    # Generic smart home vulnerabilities
    KnownVulnerability(
        id="GENERIC-2021-001",
        platform=Platform.GENERIC,
        name="UPnP Security Issues",
        description="UPnP enables automatic port forwarding which can expose devices",
        severity=Severity.MEDIUM,
        references=["https://www.kb.cert.org/vuls/id/357851"],
        remediation="Disable UPnP on router and smart home devices",
    ),
    KnownVulnerability(
        id="GENERIC-2020-001",
        platform=Platform.GENERIC,
        name="Default Credentials",
        description="Many IoT devices ship with default credentials",
        severity=Severity.CRITICAL,
        references=["https://owasp.org/www-project-iot-top-10/"],
        remediation="Change all default passwords immediately after setup",
    ),
    KnownVulnerability(
        id="GENERIC-2019-001",
        platform=Platform.GENERIC,
        name="Unencrypted Local Communication",
        description="Many smart devices communicate locally without encryption",
        severity=Severity.MEDIUM,
        references=["https://www.princeton.edu/~pmittal/publications/smart-home-imc19.pdf"],
        remediation="Use VLANs and network segmentation for IoT devices",
    ),
]


class VulnerabilityDatabase:
    """Database for known vulnerabilities."""

    def __init__(self):
        self._vulns: list[KnownVulnerability] = VULNERABILITY_DATABASE.copy()

    def get_all(self) -> list[KnownVulnerability]:
        """Get all vulnerabilities."""
        return self._vulns.copy()

    def get_by_platform(self, platform: Platform) -> list[KnownVulnerability]:
        """Get vulnerabilities for a specific platform."""
        return [v for v in self._vulns if v.platform == platform or v.platform == Platform.GENERIC]

    def get_by_cve(self, cve: str) -> Optional[KnownVulnerability]:
        """Get vulnerability by CVE ID."""
        for v in self._vulns:
            if v.cve and v.cve.lower() == cve.lower():
                return v
        return None

    def get_by_severity(self, severity: Severity) -> list[KnownVulnerability]:
        """Get vulnerabilities of specific severity or higher."""
        severity_order = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO]
        target_index = severity_order.index(severity)
        valid_severities = severity_order[:target_index + 1]
        return [v for v in self._vulns if v.severity in valid_severities]

    def check_version(
        self,
        platform: Platform,
        version: str,
    ) -> list[KnownVulnerability]:
        """Check if a version is affected by known vulnerabilities."""
        affected = []

        for vuln in self.get_by_platform(platform):
            if vuln.affected_versions and self._version_matches(version, vuln.affected_versions):
                affected.append(vuln)

        return affected

    def _version_matches(self, version: str, pattern: str) -> bool:
        """Check if version matches vulnerability pattern."""
        try:
            # Parse version
            v_parts = self._parse_version(version)
            if not v_parts:
                return False

            # Handle "<X.Y.Z" pattern
            if pattern.startswith("<"):
                target = pattern[1:]
                t_parts = self._parse_version(target)
                if t_parts:
                    return self._compare_versions(v_parts, t_parts) < 0

            # Handle "X.Y.Z-A.B.C" range pattern
            if "-" in pattern:
                parts = pattern.split("-")
                if len(parts) == 2:
                    start = self._parse_version(parts[0])
                    end = self._parse_version(parts[1])
                    if start and end:
                        return (
                            self._compare_versions(v_parts, start) >= 0 and
                            self._compare_versions(v_parts, end) <= 0
                        )

        except Exception:
            pass

        return False

    def _parse_version(self, version: str) -> Optional[tuple[int, ...]]:
        """Parse version string to tuple of integers."""
        try:
            parts = version.replace("-", ".").split(".")
            return tuple(int(p) for p in parts[:3] if p.isdigit())
        except Exception:
            return None

    def _compare_versions(self, v1: tuple[int, ...], v2: tuple[int, ...]) -> int:
        """Compare two version tuples. Returns -1, 0, or 1."""
        for i in range(max(len(v1), len(v2))):
            a = v1[i] if i < len(v1) else 0
            b = v2[i] if i < len(v2) else 0
            if a < b:
                return -1
            elif a > b:
                return 1
        return 0

    def add_vulnerability(self, vuln: KnownVulnerability) -> None:
        """Add a vulnerability to the database."""
        # Check for duplicates
        if not any(v.id == vuln.id for v in self._vulns):
            self._vulns.append(vuln)

    def search(self, query: str) -> list[KnownVulnerability]:
        """Search vulnerabilities by keyword."""
        query = query.lower()
        return [
            v for v in self._vulns
            if query in v.name.lower()
            or query in v.description.lower()
            or (v.cve and query in v.cve.lower())
        ]


# Singleton instance
_db_instance: Optional[VulnerabilityDatabase] = None


def get_vulnerability_database() -> VulnerabilityDatabase:
    """Get the vulnerability database singleton."""
    global _db_instance
    if _db_instance is None:
        _db_instance = VulnerabilityDatabase()
    return _db_instance
