"""Tests for vulnerability database and CVE checker."""

import pytest

from src.vulnerabilities.database import (
    VulnerabilityDatabase,
    KnownVulnerability,
    get_vulnerability_database,
)
from src.vulnerabilities.cve_checker import CVEChecker
from src.models import Device, Platform, Severity


class TestVulnerabilityDatabase:
    """Tests for VulnerabilityDatabase."""

    def test_database_creation(self):
        """Test database creation."""
        db = VulnerabilityDatabase()
        vulns = db.get_all()
        assert len(vulns) > 0

    def test_get_by_platform(self):
        """Test getting vulnerabilities by platform."""
        db = VulnerabilityDatabase()

        ha_vulns = db.get_by_platform(Platform.HOME_ASSISTANT)
        assert len(ha_vulns) > 0

        # All should be HA or generic
        for vuln in ha_vulns:
            assert vuln.platform in (Platform.HOME_ASSISTANT, Platform.GENERIC)

    def test_get_by_cve(self):
        """Test getting vulnerability by CVE."""
        db = VulnerabilityDatabase()

        vuln = db.get_by_cve("CVE-2023-27482")
        assert vuln is not None
        assert vuln.platform == Platform.HOME_ASSISTANT

        # Non-existent CVE
        assert db.get_by_cve("CVE-9999-99999") is None

    def test_get_by_severity(self):
        """Test getting vulnerabilities by severity."""
        db = VulnerabilityDatabase()

        critical = db.get_by_severity(Severity.CRITICAL)
        assert len(critical) > 0

        # Critical should only include critical
        for vuln in critical:
            assert vuln.severity == Severity.CRITICAL

        # High should include critical and high
        high = db.get_by_severity(Severity.HIGH)
        assert len(high) >= len(critical)

    def test_version_matching(self):
        """Test version matching logic."""
        db = VulnerabilityDatabase()

        # Test "<X.Y.Z" pattern
        assert db._version_matches("2022.12.0", "<2023.1.0") is True
        assert db._version_matches("2023.0.0", "<2023.1.0") is True
        assert db._version_matches("2023.1.0", "<2023.1.0") is False
        assert db._version_matches("2023.2.0", "<2023.1.0") is False

    def test_check_version(self):
        """Test checking version for vulnerabilities."""
        db = VulnerabilityDatabase()

        # Old HA version
        vulns = db.check_version(Platform.HOME_ASSISTANT, "2022.12.0")
        assert len(vulns) > 0

        # Very new version (should have fewer vulns)
        vulns_new = db.check_version(Platform.HOME_ASSISTANT, "2024.1.0")
        assert len(vulns_new) < len(vulns)

    def test_search(self):
        """Test searching vulnerabilities."""
        db = VulnerabilityDatabase()

        results = db.search("authentication")
        assert len(results) > 0

        results = db.search("nonexistent-term-xyz")
        assert len(results) == 0

    def test_add_vulnerability(self):
        """Test adding a vulnerability."""
        db = VulnerabilityDatabase()
        initial_count = len(db.get_all())

        new_vuln = KnownVulnerability(
            id="TEST-001",
            platform=Platform.GENERIC,
            name="Test Vulnerability",
            description="A test vulnerability",
            severity=Severity.LOW,
            remediation="Test remediation",
        )

        db.add_vulnerability(new_vuln)
        assert len(db.get_all()) == initial_count + 1

        # Adding same ID again should not duplicate
        db.add_vulnerability(new_vuln)
        assert len(db.get_all()) == initial_count + 1


class TestCVEChecker:
    """Tests for CVEChecker."""

    def test_checker_creation(self):
        """Test checker creation."""
        checker = CVEChecker()
        assert checker.use_online is False
        assert checker.db is not None

    def test_checker_online_disabled(self):
        """Test checker with online disabled."""
        checker = CVEChecker(use_online=False)
        assert checker.use_online is False

    @pytest.mark.asyncio
    async def test_check_device_local(self):
        """Test checking device against local database."""
        checker = CVEChecker(use_online=False)

        device = Device(
            ip="192.168.1.100",
            platform=Platform.HOME_ASSISTANT,
            firmware_version="2022.12.0",
        )

        findings = await checker.check_device(device)
        assert isinstance(findings, list)

    @pytest.mark.asyncio
    async def test_check_device_no_version(self):
        """Test checking device without version info."""
        checker = CVEChecker(use_online=False)

        device = Device(
            ip="192.168.1.100",
            platform=Platform.GENERIC,
        )

        findings = await checker.check_device(device)
        assert isinstance(findings, list)

    def test_score_to_severity(self):
        """Test CVSS score to severity conversion."""
        checker = CVEChecker()

        assert checker._score_to_severity(10.0) == Severity.CRITICAL
        assert checker._score_to_severity(9.0) == Severity.CRITICAL
        assert checker._score_to_severity(8.0) == Severity.HIGH
        assert checker._score_to_severity(7.0) == Severity.HIGH
        assert checker._score_to_severity(5.0) == Severity.MEDIUM
        assert checker._score_to_severity(2.0) == Severity.LOW
        assert checker._score_to_severity(0.0) == Severity.INFO


class TestSingletonDatabase:
    """Tests for singleton database instance."""

    def test_singleton(self):
        """Test that get_vulnerability_database returns singleton."""
        db1 = get_vulnerability_database()
        db2 = get_vulnerability_database()

        assert db1 is db2
