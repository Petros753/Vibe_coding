"""Tests for reporters."""

import pytest
import json
import tempfile
from pathlib import Path
from datetime import datetime

from src.reporters.console import ConsoleReporter
from src.reporters.html import HTMLReporter
from src.reporters.json import JSONReporter
from src.models import (
    AuditSession,
    AuditResult,
    Device,
    Finding,
    ScanResult,
    Severity,
)


class TestConsoleReporter:
    """Tests for ConsoleReporter."""

    def test_reporter_creation(self):
        """Test reporter creation."""
        reporter = ConsoleReporter()
        assert reporter.console is not None
        assert reporter.verbose is False

    def test_reporter_verbose_mode(self):
        """Test reporter in verbose mode."""
        reporter = ConsoleReporter(verbose=True)
        assert reporter.verbose is True

    def test_score_color(self):
        """Test score color calculation."""
        reporter = ConsoleReporter()

        assert reporter._score_color(90) == "green"
        assert reporter._score_color(75) == "green"
        assert reporter._score_color(60) == "yellow"
        assert reporter._score_color(40) == "red"

    def test_get_rating(self):
        """Test rating calculation."""
        reporter = ConsoleReporter()

        assert reporter._get_rating(95) == "Excellent"
        assert reporter._get_rating(80) == "Good"
        assert reporter._get_rating(55) == "Fair"
        assert reporter._get_rating(30) == "Poor"
        assert reporter._get_rating(10) == "Critical"


class TestHTMLReporter:
    """Tests for HTMLReporter."""

    def test_reporter_creation(self):
        """Test reporter creation."""
        reporter = HTMLReporter()
        assert reporter.output_path is None

    def test_generate_html(self):
        """Test HTML generation."""
        reporter = HTMLReporter()

        device = Device(ip="192.168.1.100")
        result = AuditResult(
            device=device,
            auditor_name="TestAuditor",
            findings=[
                Finding(
                    check_id="test-001",
                    title="Test Finding",
                    description="Test description",
                    severity=Severity.HIGH,
                    affected_device=device,
                    remediation="Test remediation",
                )
            ],
        )

        session = AuditSession(audit_results=[result])

        html = reporter.generate(session)

        assert "<!DOCTYPE html>" in html
        assert "SmartHome Security Audit Report" in html
        assert "192.168.1.100" in html
        assert "Test Finding" in html

    def test_save_html(self):
        """Test saving HTML to file."""
        reporter = HTMLReporter()

        device = Device(ip="192.168.1.100")
        result = AuditResult(device=device, auditor_name="Test")
        session = AuditSession(audit_results=[result])

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "report.html"
            saved_path = reporter.save(session, str(output_path))

            assert Path(saved_path).exists()

            with open(saved_path, "r") as f:
                content = f.read()
                assert "<!DOCTYPE html>" in content


class TestJSONReporter:
    """Tests for JSONReporter."""

    def test_reporter_creation(self):
        """Test reporter creation."""
        reporter = JSONReporter()
        assert reporter.indent == 2

    def test_generate_json(self):
        """Test JSON generation."""
        reporter = JSONReporter()

        device = Device(ip="192.168.1.100")
        result = AuditResult(
            device=device,
            auditor_name="TestAuditor",
        )

        session = AuditSession(audit_results=[result])

        data = reporter.generate(session)

        assert "report" in data
        assert "summary" in data
        assert "audit_results" in data
        assert data["summary"]["total_devices"] == 1

    def test_to_json_string(self):
        """Test JSON string generation."""
        reporter = JSONReporter()

        device = Device(ip="192.168.1.100")
        result = AuditResult(device=device, auditor_name="Test")
        session = AuditSession(audit_results=[result])

        json_str = reporter.to_json(session)

        # Should be valid JSON
        parsed = json.loads(json_str)
        assert "report" in parsed

    def test_save_json(self):
        """Test saving JSON to file."""
        reporter = JSONReporter()

        device = Device(ip="192.168.1.100")
        result = AuditResult(device=device, auditor_name="Test")
        session = AuditSession(audit_results=[result])

        with tempfile.TemporaryDirectory() as tmpdir:
            output_path = Path(tmpdir) / "report.json"
            saved_path = reporter.save(session, str(output_path))

            assert Path(saved_path).exists()

            with open(saved_path, "r") as f:
                data = json.load(f)
                assert "report" in data

    def test_serialize_finding(self):
        """Test finding serialization."""
        reporter = JSONReporter()

        device = Device(ip="192.168.1.100")
        finding = Finding(
            check_id="test-001",
            title="Test",
            description="Description",
            severity=Severity.CRITICAL,
            affected_device=device,
            remediation="Fix it",
            references=["https://example.com"],
        )

        serialized = reporter._serialize_finding(finding)

        assert serialized["check_id"] == "test-001"
        assert serialized["severity"] == "critical"
        assert serialized["severity_score"] == 5
        assert "https://example.com" in serialized["references"]

    def test_serialize_device(self):
        """Test device serialization."""
        reporter = JSONReporter()

        device = Device(
            ip="192.168.1.100",
            hostname="test-device.local",
            vendor="Test Vendor",
            open_ports=[PortInfo(port=80, service="http") for PortInfo in [__import__("src.models", fromlist=["PortInfo"]).PortInfo]],
        )

        serialized = reporter._serialize_device(device)

        assert serialized["ip"] == "192.168.1.100"
        assert serialized["hostname"] == "test-device.local"
        assert len(serialized["open_ports"]) == 1

    def test_rating_calculation(self):
        """Test rating calculation."""
        reporter = JSONReporter()

        assert reporter._get_rating(95) == "excellent"
        assert reporter._get_rating(80) == "good"
        assert reporter._get_rating(60) == "fair"
        assert reporter._get_rating(30) == "poor"
        assert reporter._get_rating(10) == "critical"
