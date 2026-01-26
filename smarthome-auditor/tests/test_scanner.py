"""Tests for network scanner."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.scanner.network import NetworkScanner
from src.scanner.ports import PortScanner, QUICK_SCAN_PORTS
from src.scanner.services import ServiceDetector
from src.models import Device, PortInfo


class TestPortScanner:
    """Tests for PortScanner."""

    def test_scanner_creation(self):
        """Test scanner creation with default settings."""
        scanner = PortScanner()
        assert scanner.timeout == 1.0
        assert scanner.max_concurrent == 100

    def test_scanner_custom_settings(self):
        """Test scanner creation with custom settings."""
        scanner = PortScanner(timeout=2.0, max_concurrent=50)
        assert scanner.timeout == 2.0
        assert scanner.max_concurrent == 50

    def test_service_identification(self):
        """Test service identification by port."""
        scanner = PortScanner()

        assert scanner._identify_service(22) == "ssh"
        assert scanner._identify_service(80) == "http"
        assert scanner._identify_service(443) == "https"
        assert scanner._identify_service(8123) == "home_assistant"
        assert scanner._identify_service(1883) == "mqtt"
        assert scanner._identify_service(12345) is None  # Unknown port

    @pytest.mark.asyncio
    async def test_scan_empty_host(self):
        """Test scanning a non-existent host."""
        scanner = PortScanner(timeout=0.1)

        # This should return empty list (host not reachable)
        result = await scanner.scan("192.0.2.1", ports=[80, 443])
        assert isinstance(result, list)


class TestServiceDetector:
    """Tests for ServiceDetector."""

    def test_detector_creation(self):
        """Test detector creation."""
        detector = ServiceDetector()
        assert detector.timeout == 5.0

    def test_detector_custom_timeout(self):
        """Test detector with custom timeout."""
        detector = ServiceDetector(timeout=10.0)
        assert detector.timeout == 10.0

    @pytest.mark.asyncio
    async def test_detect_empty_device(self):
        """Test detection on device with no ports."""
        detector = ServiceDetector()
        device = Device(ip="192.168.1.100")

        services = await detector.detect(device)
        assert isinstance(services, dict)

    def test_ssh_version_parsing(self):
        """Test SSH version parsing from banner."""
        detector = ServiceDetector()

        banner = "SSH-2.0-OpenSSH_8.2p1"
        version = detector._parse_ssh_version(banner)
        assert version == "SSH-2.0-OpenSSH_8.2p1"

        assert detector._parse_ssh_version("") is None
        assert detector._parse_ssh_version(None) is None


class TestNetworkScanner:
    """Tests for NetworkScanner."""

    def test_scanner_creation(self):
        """Test scanner creation."""
        scanner = NetworkScanner()
        assert scanner.timeout == 2.0
        assert scanner.max_concurrent == 100

    def test_smart_home_identification(self):
        """Test smart home device identification."""
        scanner = NetworkScanner()

        # Device with HA port
        device_ha = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=8123, service="home_assistant")],
        )
        assert scanner._is_smart_home_device(device_ha) is True

        # Device with Espressif vendor (common for smart home)
        device_esp = Device(
            ip="192.168.1.101",
            vendor="Espressif Inc.",
        )
        assert scanner._is_smart_home_device(device_esp) is True

        # Regular device
        device_regular = Device(
            ip="192.168.1.102",
            open_ports=[PortInfo(port=22, service="ssh")],
        )
        assert scanner._is_smart_home_device(device_regular) is False

    def test_device_type_identification(self):
        """Test device type identification."""
        scanner = NetworkScanner()

        # Home Assistant hub
        device_ha = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=8123)],
        )
        assert scanner._identify_device_type(device_ha).value == "hub"

        # MQTT hub
        device_mqtt = Device(
            ip="192.168.1.101",
            open_ports=[PortInfo(port=1883)],
        )
        assert scanner._identify_device_type(device_mqtt).value == "hub"

    def test_platform_identification(self):
        """Test platform identification."""
        scanner = NetworkScanner()

        # Home Assistant
        device_ha = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=8123)],
        )
        assert scanner._identify_platform(device_ha).value == "home_assistant"

        # Tuya
        device_tuya = Device(
            ip="192.168.1.101",
            open_ports=[PortInfo(port=6668)],
        )
        assert scanner._identify_platform(device_tuya).value == "tuya"

        # Xiaomi
        device_xiaomi = Device(
            ip="192.168.1.102",
            open_ports=[PortInfo(port=54321)],
        )
        assert scanner._identify_platform(device_xiaomi).value == "xiaomi"

    @pytest.mark.asyncio
    async def test_scan_invalid_network(self):
        """Test scanning with invalid network."""
        scanner = NetworkScanner()

        with pytest.raises(ValueError):
            await scanner.scan("invalid-network")

    @pytest.mark.asyncio
    async def test_scan_too_large_network(self):
        """Test scanning network that's too large."""
        scanner = NetworkScanner()

        with pytest.raises(ValueError, match="too large"):
            await scanner.scan("10.0.0.0/8")  # Over 16 million hosts


class TestQuickScanPorts:
    """Tests for quick scan port list."""

    def test_quick_scan_ports_includes_smart_home(self):
        """Test that quick scan includes smart home ports."""
        smart_home_ports = [8123, 1883, 6668, 54321]

        for port in smart_home_ports:
            assert port in QUICK_SCAN_PORTS

    def test_quick_scan_ports_includes_common(self):
        """Test that quick scan includes common ports."""
        common_ports = [22, 80, 443, 8080]

        for port in common_ports:
            assert port in QUICK_SCAN_PORTS
