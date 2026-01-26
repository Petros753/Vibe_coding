"""Tests for data models."""

import pytest
from datetime import datetime

from src.models import (
    Device,
    DeviceType,
    Finding,
    Platform,
    PortInfo,
    Severity,
    AuditResult,
    ScanResult,
    AuditSession,
)


class TestSeverity:
    """Tests for Severity enum."""

    def test_severity_scores(self):
        """Test severity score values."""
        assert Severity.CRITICAL.score == 5
        assert Severity.HIGH.score == 4
        assert Severity.MEDIUM.score == 3
        assert Severity.LOW.score == 2
        assert Severity.INFO.score == 1

    def test_severity_colors(self):
        """Test severity colors."""
        assert "red" in Severity.CRITICAL.color
        assert "red" in Severity.HIGH.color
        assert "yellow" in Severity.MEDIUM.color

    def test_severity_emojis(self):
        """Test severity emojis."""
        assert Severity.CRITICAL.emoji == "✗"
        assert Severity.HIGH.emoji == "✗"
        assert Severity.MEDIUM.emoji == "⚠"


class TestDevice:
    """Tests for Device model."""

    def test_device_creation(self):
        """Test basic device creation."""
        device = Device(ip="192.168.1.100")
        assert device.ip == "192.168.1.100"
        assert device.device_type == DeviceType.UNKNOWN
        assert device.platform == Platform.UNKNOWN

    def test_device_with_ports(self):
        """Test device with open ports."""
        ports = [
            PortInfo(port=80, service="http"),
            PortInfo(port=443, service="https"),
        ]
        device = Device(ip="192.168.1.100", open_ports=ports)

        assert len(device.open_ports) == 2
        assert device.has_port(80)
        assert device.has_port(443)
        assert not device.has_port(22)

    def test_device_display_name(self):
        """Test display name generation."""
        device = Device(ip="192.168.1.100")
        assert device.display_name == "192.168.1.100"

        device.hostname = "my-device.local"
        assert "my-device.local" in device.display_name

    def test_device_get_port_info(self):
        """Test getting port info."""
        ports = [PortInfo(port=8123, service="home_assistant")]
        device = Device(ip="192.168.1.100", open_ports=ports)

        port_info = device.get_port_info(8123)
        assert port_info is not None
        assert port_info.service == "home_assistant"

        assert device.get_port_info(80) is None

    def test_invalid_ip(self):
        """Test that invalid IP raises error."""
        with pytest.raises(ValueError):
            Device(ip="invalid-ip")


class TestPortInfo:
    """Tests for PortInfo model."""

    def test_port_info_creation(self):
        """Test basic port info creation."""
        port = PortInfo(port=80)
        assert port.port == 80
        assert port.protocol == "tcp"
        assert port.state == "open"

    def test_port_info_with_service(self):
        """Test port info with service details."""
        port = PortInfo(
            port=8123,
            service="home_assistant",
            banner="Home Assistant API",
        )
        assert port.service == "home_assistant"
        assert port.banner == "Home Assistant API"

    def test_invalid_port_number(self):
        """Test that invalid port numbers raise errors."""
        with pytest.raises(ValueError):
            PortInfo(port=0)

        with pytest.raises(ValueError):
            PortInfo(port=70000)


class TestFinding:
    """Tests for Finding model."""

    def test_finding_creation(self):
        """Test basic finding creation."""
        device = Device(ip="192.168.1.100")
        finding = Finding(
            check_id="test-001",
            title="Test Finding",
            description="This is a test",
            severity=Severity.HIGH,
            affected_device=device,
            remediation="Fix it",
        )

        assert finding.title == "Test Finding"
        assert finding.severity == Severity.HIGH
        assert finding.is_high_or_above

    def test_finding_is_critical(self):
        """Test critical finding detection."""
        device = Device(ip="192.168.1.100")

        critical = Finding(
            check_id="test-001",
            title="Critical",
            description="Critical finding",
            severity=Severity.CRITICAL,
            affected_device=device,
            remediation="Fix now",
        )
        assert critical.is_critical

        medium = Finding(
            check_id="test-002",
            title="Medium",
            description="Medium finding",
            severity=Severity.MEDIUM,
            affected_device=device,
            remediation="Fix soon",
        )
        assert not medium.is_critical


class TestAuditResult:
    """Tests for AuditResult model."""

    def test_audit_result_creation(self):
        """Test basic audit result creation."""
        device = Device(ip="192.168.1.100")
        result = AuditResult(
            device=device,
            auditor_name="TestAuditor",
        )

        assert result.device == device
        assert result.total_findings == 0
        assert result.security_score == 100

    def test_audit_result_with_findings(self):
        """Test audit result with findings."""
        device = Device(ip="192.168.1.100")

        findings = [
            Finding(
                check_id="test-001",
                title="Critical Issue",
                description="Test",
                severity=Severity.CRITICAL,
                affected_device=device,
                remediation="Fix",
            ),
            Finding(
                check_id="test-002",
                title="Medium Issue",
                description="Test",
                severity=Severity.MEDIUM,
                affected_device=device,
                remediation="Fix",
            ),
        ]

        result = AuditResult(
            device=device,
            auditor_name="TestAuditor",
            findings=findings,
        )

        assert result.total_findings == 2
        assert result.critical_count == 1
        assert result.medium_count == 1
        assert result.security_score < 100

    def test_security_score_calculation(self):
        """Test security score calculation."""
        device = Device(ip="192.168.1.100")

        # No findings = perfect score
        result = AuditResult(device=device, auditor_name="Test")
        assert result.security_score == 100

        # Add critical finding
        result.findings.append(
            Finding(
                check_id="test",
                title="Critical",
                description="Test",
                severity=Severity.CRITICAL,
                affected_device=device,
                remediation="Fix",
            )
        )
        assert result.security_score == 75  # 100 - 25

    def test_score_rating(self):
        """Test score rating calculation."""
        device = Device(ip="192.168.1.100")
        result = AuditResult(device=device, auditor_name="Test")

        # Perfect score
        assert result.score_rating == "Excellent"

        # Add findings to lower score
        for _ in range(4):
            result.findings.append(
                Finding(
                    check_id="test",
                    title="Critical",
                    description="Test",
                    severity=Severity.CRITICAL,
                    affected_device=device,
                    remediation="Fix",
                )
            )

        assert result.security_score == 0
        assert result.score_rating == "Critical"


class TestScanResult:
    """Tests for ScanResult model."""

    def test_scan_result_creation(self):
        """Test basic scan result creation."""
        result = ScanResult(network="192.168.1.0/24")
        assert result.network == "192.168.1.0/24"
        assert result.total_devices == 0

    def test_scan_result_with_devices(self):
        """Test scan result with devices."""
        devices = [
            Device(ip="192.168.1.1"),
            Device(ip="192.168.1.2"),
        ]
        smart_devices = [devices[0]]

        result = ScanResult(
            network="192.168.1.0/24",
            devices=devices,
            smart_home_devices=smart_devices,
        )

        assert result.total_devices == 2
        assert result.smart_home_count == 1


class TestAuditSession:
    """Tests for AuditSession model."""

    def test_session_creation(self):
        """Test basic session creation."""
        session = AuditSession()
        assert session.id is not None
        assert session.overall_score == 100

    def test_session_with_results(self):
        """Test session with audit results."""
        device = Device(ip="192.168.1.100")
        result = AuditResult(
            device=device,
            auditor_name="Test",
        )

        session = AuditSession(audit_results=[result])
        assert len(session.audit_results) == 1
        assert session.total_findings == 0

    def test_findings_by_severity(self):
        """Test getting findings by severity."""
        device = Device(ip="192.168.1.100")

        findings = [
            Finding(
                check_id="test-001",
                title="Critical",
                description="Test",
                severity=Severity.CRITICAL,
                affected_device=device,
                remediation="Fix",
            ),
            Finding(
                check_id="test-002",
                title="High",
                description="Test",
                severity=Severity.HIGH,
                affected_device=device,
                remediation="Fix",
            ),
        ]

        result = AuditResult(
            device=device,
            auditor_name="Test",
            findings=findings,
        )

        session = AuditSession(audit_results=[result])

        critical = session.findings_by_severity(Severity.CRITICAL)
        assert len(critical) == 1
        assert critical[0].title == "Critical"
