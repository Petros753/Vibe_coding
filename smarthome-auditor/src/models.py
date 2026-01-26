"""Core data models for SmartHome Security Auditor."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from ipaddress import IPv4Address, IPv4Network

from pydantic import BaseModel, Field, field_validator


class Severity(str, Enum):
    """Severity levels for security findings."""

    CRITICAL = "critical"  # Immediate exploitation possible
    HIGH = "high"          # Serious vulnerability
    MEDIUM = "medium"      # Potential risk
    LOW = "low"            # Minor risk
    INFO = "info"          # Informational message

    @property
    def score(self) -> int:
        """Numeric score for severity."""
        scores = {
            "critical": 5,
            "high": 4,
            "medium": 3,
            "low": 2,
            "info": 1,
        }
        return scores[self.value]

    @property
    def emoji(self) -> str:
        """Emoji representation for severity."""
        emojis = {
            "critical": "✗",
            "high": "✗",
            "medium": "⚠",
            "low": "⚠",
            "info": "ℹ",
        }
        return emojis[self.value]

    @property
    def color(self) -> str:
        """Rich color for severity."""
        colors = {
            "critical": "red bold",
            "high": "red",
            "medium": "yellow",
            "low": "blue",
            "info": "cyan",
        }
        return colors[self.value]


class DeviceType(str, Enum):
    """Types of smart home devices."""

    HUB = "hub"
    GATEWAY = "gateway"
    CAMERA = "camera"
    THERMOSTAT = "thermostat"
    LIGHT = "light"
    SWITCH = "switch"
    SENSOR = "sensor"
    LOCK = "lock"
    SPEAKER = "speaker"
    ROUTER = "router"
    BRIDGE = "bridge"
    UNKNOWN = "unknown"


class Platform(str, Enum):
    """Smart home platforms."""

    HOME_ASSISTANT = "home_assistant"
    TUYA = "tuya"
    XIAOMI = "xiaomi"
    ZIGBEE = "zigbee"
    ZWAVE = "zwave"
    MQTT = "mqtt"
    HOMEKIT = "homekit"
    GOOGLE_HOME = "google_home"
    ALEXA = "alexa"
    GENERIC = "generic"
    UNKNOWN = "unknown"


class Protocol(str, Enum):
    """Network protocols."""

    HTTP = "http"
    HTTPS = "https"
    MQTT = "mqtt"
    MQTTS = "mqtts"
    COAP = "coap"
    ZIGBEE = "zigbee"
    ZWAVE = "zwave"
    TELNET = "telnet"
    SSH = "ssh"
    UNKNOWN = "unknown"


class PortInfo(BaseModel):
    """Information about an open port."""

    port: int = Field(..., ge=1, le=65535)
    protocol: str = "tcp"
    state: str = "open"
    service: Optional[str] = None
    version: Optional[str] = None
    banner: Optional[str] = None

    class Config:
        frozen = True


class Device(BaseModel):
    """Discovered smart home device."""

    ip: str
    mac: Optional[str] = None
    hostname: Optional[str] = None
    vendor: Optional[str] = None
    device_type: DeviceType = DeviceType.UNKNOWN
    platform: Platform = Platform.UNKNOWN
    model: Optional[str] = None
    firmware_version: Optional[str] = None
    open_ports: list[PortInfo] = Field(default_factory=list)
    services: dict[str, Any] = Field(default_factory=dict)
    discovered_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("ip")
    @classmethod
    def validate_ip(cls, v: str) -> str:
        """Validate IP address format."""
        try:
            IPv4Address(v)
            return v
        except ValueError:
            raise ValueError(f"Invalid IP address: {v}")

    @property
    def display_name(self) -> str:
        """Human-readable device name."""
        if self.hostname:
            return f"{self.hostname} ({self.ip})"
        if self.vendor:
            return f"{self.vendor} Device ({self.ip})"
        return self.ip

    def has_port(self, port: int) -> bool:
        """Check if device has a specific port open."""
        return any(p.port == port for p in self.open_ports)

    def get_port_info(self, port: int) -> Optional[PortInfo]:
        """Get information about a specific port."""
        for p in self.open_ports:
            if p.port == port:
                return p
        return None


class Target(BaseModel):
    """Audit target - can be a single device or network."""

    device: Optional[Device] = None
    network: Optional[str] = None

    @field_validator("network")
    @classmethod
    def validate_network(cls, v: Optional[str]) -> Optional[str]:
        """Validate network CIDR format."""
        if v is None:
            return v
        try:
            IPv4Network(v, strict=False)
            return v
        except ValueError:
            raise ValueError(f"Invalid network CIDR: {v}")


class SecurityCheck(BaseModel):
    """A security check that can be performed."""

    id: str
    name: str
    description: str
    category: str
    severity_if_failed: Severity
    requires_root: bool = False
    enabled: bool = True


class Finding(BaseModel):
    """A security finding from an audit."""

    check_id: str
    title: str
    description: str
    severity: Severity
    affected_device: Device
    remediation: str
    references: list[str] = Field(default_factory=list)
    evidence: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @property
    def is_critical(self) -> bool:
        """Check if finding is critical."""
        return self.severity == Severity.CRITICAL

    @property
    def is_high_or_above(self) -> bool:
        """Check if finding is high severity or above."""
        return self.severity in (Severity.CRITICAL, Severity.HIGH)


class PassedCheck(BaseModel):
    """A security check that passed."""

    check_id: str
    title: str
    device: Device
    timestamp: datetime = Field(default_factory=datetime.now)


class AuditResult(BaseModel):
    """Results from a security audit."""

    device: Device
    auditor_name: str
    findings: list[Finding] = Field(default_factory=list)
    passed_checks: list[PassedCheck] = Field(default_factory=list)
    skipped_checks: list[str] = Field(default_factory=list)
    start_time: datetime = Field(default_factory=datetime.now)
    end_time: Optional[datetime] = None
    error: Optional[str] = None

    @property
    def critical_count(self) -> int:
        """Count of critical findings."""
        return sum(1 for f in self.findings if f.severity == Severity.CRITICAL)

    @property
    def high_count(self) -> int:
        """Count of high severity findings."""
        return sum(1 for f in self.findings if f.severity == Severity.HIGH)

    @property
    def medium_count(self) -> int:
        """Count of medium severity findings."""
        return sum(1 for f in self.findings if f.severity == Severity.MEDIUM)

    @property
    def low_count(self) -> int:
        """Count of low severity findings."""
        return sum(1 for f in self.findings if f.severity == Severity.LOW)

    @property
    def info_count(self) -> int:
        """Count of informational findings."""
        return sum(1 for f in self.findings if f.severity == Severity.INFO)

    @property
    def total_findings(self) -> int:
        """Total number of findings."""
        return len(self.findings)

    @property
    def security_score(self) -> int:
        """Calculate security score (0-100)."""
        if not self.findings and not self.passed_checks:
            return 100

        # Deduct points based on severity
        deductions = {
            Severity.CRITICAL: 25,
            Severity.HIGH: 15,
            Severity.MEDIUM: 8,
            Severity.LOW: 3,
            Severity.INFO: 1,
        }

        total_deduction = sum(
            deductions.get(f.severity, 0) for f in self.findings
        )

        # Cap at 0
        return max(0, 100 - total_deduction)

    @property
    def score_rating(self) -> str:
        """Get rating based on score."""
        score = self.security_score
        if score >= 90:
            return "Excellent"
        elif score >= 75:
            return "Good"
        elif score >= 50:
            return "Fair"
        elif score >= 25:
            return "Poor"
        else:
            return "Critical"


class ScanResult(BaseModel):
    """Results from a network scan."""

    network: str
    devices: list[Device] = Field(default_factory=list)
    smart_home_devices: list[Device] = Field(default_factory=list)
    start_time: datetime = Field(default_factory=datetime.now)
    end_time: Optional[datetime] = None
    scan_type: str = "quick"

    @property
    def total_devices(self) -> int:
        """Total number of discovered devices."""
        return len(self.devices)

    @property
    def smart_home_count(self) -> int:
        """Number of identified smart home devices."""
        return len(self.smart_home_devices)


class AuditSession(BaseModel):
    """A complete audit session with multiple devices."""

    id: str = Field(default_factory=lambda: datetime.now().strftime("%Y%m%d_%H%M%S"))
    scan_result: Optional[ScanResult] = None
    audit_results: list[AuditResult] = Field(default_factory=list)
    start_time: datetime = Field(default_factory=datetime.now)
    end_time: Optional[datetime] = None
    config: dict[str, Any] = Field(default_factory=dict)

    @property
    def overall_score(self) -> int:
        """Calculate overall security score."""
        if not self.audit_results:
            return 100

        scores = [r.security_score for r in self.audit_results]
        return sum(scores) // len(scores)

    @property
    def total_findings(self) -> int:
        """Total findings across all audits."""
        return sum(r.total_findings for r in self.audit_results)

    def findings_by_severity(self, severity: Severity) -> list[Finding]:
        """Get all findings of a specific severity."""
        findings = []
        for result in self.audit_results:
            findings.extend(f for f in result.findings if f.severity == severity)
        return findings


# OUI Database for MAC vendor lookup (partial)
OUI_DATABASE: dict[str, str] = {
    "00:17:88": "Philips Lighting BV",
    "00:1A:22": "eQ-3 Entwicklung GmbH",
    "00:1E:C0": "Microchip Technology",
    "04:CF:8C": "Xiaomi Communications",
    "10:13:31": "Technicolor",
    "18:B4:30": "Nest Labs",
    "20:DF:B9": "Google",
    "24:62:AB": "Espressif",
    "28:6D:CD": "Xiaomi",
    "2C:F4:32": "Espressif",
    "30:AE:A4": "Espressif",
    "34:EA:34": "HangZhou Hikvision",
    "3C:71:BF": "Espressif",
    "40:31:3C": "Xiaomi Communications",
    "44:67:55": "Orbit Irrigation Products",
    "48:E7:29": "Xiaomi Communications",
    "50:02:91": "Espressif",
    "54:48:E6": "Xiaomi Communications",
    "5C:CF:7F": "Espressif",
    "60:01:94": "Espressif",
    "64:90:C1": "Xiaomi Communications",
    "68:57:2D": "Tuya Smart",
    "74:4D:28": "Amazon Technologies",
    "78:21:84": "Xiaomi Communications",
    "7C:49:EB": "Xiaomi Communications",
    "80:7D:3A": "Espressif",
    "84:0D:8E": "Espressif",
    "84:F3:EB": "Espressif",
    "8C:AA:B5": "Xiaomi Communications",
    "90:38:0C": "Honeywell",
    "94:B9:7E": "Xiaomi Communications",
    "98:CD:AC": "Espressif",
    "A0:20:A6": "Espressif",
    "A4:7B:9D": "Xiaomi Communications",
    "A4:CF:12": "Espressif",
    "AC:67:B2": "Espressif",
    "B4:E6:2D": "Espressif",
    "BC:DD:C2": "Espressif",
    "C4:4F:33": "Espressif",
    "C8:2B:96": "Espressif",
    "CC:50:E3": "Espressif",
    "D4:D4:DA": "Espressif",
    "D8:F1:5B": "Espressif",
    "DC:4F:22": "Espressif",
    "E0:98:06": "Espressif",
    "E8:DB:84": "Espressif",
    "EC:FA:BC": "Espressif",
    "F0:08:D1": "Tuya Smart",
    "F4:CF:A2": "Espressif",
    "FC:F5:C4": "Espressif",
}

# Common smart home ports
SMART_HOME_PORTS: dict[int, dict[str, str]] = {
    80: {"service": "http", "description": "Web interface"},
    443: {"service": "https", "description": "Secure web interface"},
    1883: {"service": "mqtt", "description": "MQTT broker"},
    8883: {"service": "mqtts", "description": "MQTT over TLS"},
    8123: {"service": "home_assistant", "description": "Home Assistant"},
    8080: {"service": "http-alt", "description": "Alternative HTTP"},
    8443: {"service": "https-alt", "description": "Alternative HTTPS"},
    5683: {"service": "coap", "description": "CoAP protocol"},
    6668: {"service": "tuya", "description": "Tuya local API"},
    6669: {"service": "tuya", "description": "Tuya local API"},
    54321: {"service": "xiaomi", "description": "Xiaomi Mi Home"},
    21063: {"service": "homekit", "description": "HomeKit"},
    22: {"service": "ssh", "description": "SSH access"},
    23: {"service": "telnet", "description": "Telnet access"},
    5353: {"service": "mdns", "description": "mDNS/Bonjour"},
    1900: {"service": "ssdp", "description": "UPnP SSDP"},
    49152: {"service": "upnp", "description": "UPnP"},
    51827: {"service": "homekit", "description": "HomeKit HAP"},
}

# Default credentials to check
DEFAULT_CREDENTIALS: list[tuple[str, str, list[str]]] = [
    ("admin", "admin", ["generic", "router", "camera"]),
    ("admin", "password", ["generic", "router"]),
    ("admin", "1234", ["generic"]),
    ("admin", "", ["generic", "router"]),
    ("root", "root", ["linux", "embedded"]),
    ("root", "", ["linux", "embedded"]),
    ("root", "admin", ["linux", "embedded"]),
    ("user", "user", ["generic"]),
    ("guest", "guest", ["generic"]),
    ("pi", "raspberry", ["raspberry_pi"]),
    ("homeassistant", "homeassistant", ["home_assistant"]),
    ("tuya", "tuya", ["tuya"]),
    ("ubnt", "ubnt", ["ubiquiti"]),
    ("admin", "hikvision", ["hikvision"]),
    ("admin", "12345", ["hikvision", "camera"]),
]
