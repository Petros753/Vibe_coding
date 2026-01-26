"""Tests for security auditors."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.models import Device, DeviceType, Platform, PortInfo, Severity
from src.auditors.base import BaseAuditor, AuditorRegistry
from src.auditors.generic import GenericAuditor
from src.auditors.homeassistant import HomeAssistantAuditor
from src.auditors.mqtt import MQTTAuditor


class TestBaseAuditor:
    """Tests for BaseAuditor class."""

    def test_auditor_registry(self):
        """Test auditor registration."""
        auditors = AuditorRegistry.get_all()
        assert len(auditors) > 0

    @pytest.mark.asyncio
    async def test_get_applicable_auditors(self):
        """Test getting applicable auditors for a device."""
        device = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=8123, service="home_assistant")],
        )

        auditors = await AuditorRegistry.get_applicable(device)
        # Should at least include generic auditor
        assert len(auditors) >= 1


class TestGenericAuditor:
    """Tests for GenericAuditor."""

    def test_auditor_properties(self):
        """Test auditor properties."""
        auditor = GenericAuditor()
        assert auditor.name == "Generic Security Auditor"
        assert len(auditor.checks) > 0

    @pytest.mark.asyncio
    async def test_detect_always_true(self):
        """Test that generic auditor applies to all devices."""
        auditor = GenericAuditor()
        device = Device(ip="192.168.1.100")

        result = await auditor.detect(device)
        assert result is True

    @pytest.mark.asyncio
    async def test_audit_device(self):
        """Test auditing a device."""
        auditor = GenericAuditor()
        device = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=23, service="telnet")],
        )

        result = await auditor.audit(device)

        assert result.device == device
        assert result.auditor_name == "Generic Security Auditor"
        # Should find telnet as a vulnerability
        telnet_findings = [f for f in result.findings if "telnet" in f.title.lower()]
        assert len(telnet_findings) > 0

    @pytest.mark.asyncio
    async def test_telnet_check(self):
        """Test telnet vulnerability detection."""
        auditor = GenericAuditor()

        # Device with telnet
        device_with_telnet = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=23, service="telnet")],
        )

        result = await auditor.audit(device_with_telnet)
        telnet_findings = [f for f in result.findings if f.check_id == "generic-006"]
        assert len(telnet_findings) == 1
        assert telnet_findings[0].severity == Severity.HIGH

        # Device without telnet
        device_no_telnet = Device(
            ip="192.168.1.101",
            open_ports=[PortInfo(port=22, service="ssh")],
        )

        result = await auditor.audit(device_no_telnet)
        telnet_findings = [f for f in result.findings if f.check_id == "generic-006"]
        assert len(telnet_findings) == 0

    @pytest.mark.asyncio
    async def test_upnp_check(self):
        """Test UPnP vulnerability detection."""
        auditor = GenericAuditor()

        device = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=1900, service="ssdp")],
        )

        result = await auditor.audit(device)
        upnp_findings = [f for f in result.findings if "upnp" in f.title.lower()]
        assert len(upnp_findings) > 0

    @pytest.mark.asyncio
    async def test_many_ports_check(self):
        """Test excessive open ports detection."""
        auditor = GenericAuditor()

        # Device with many ports
        ports = [PortInfo(port=i) for i in range(1, 15)]
        device = Device(ip="192.168.1.100", open_ports=ports)

        result = await auditor.audit(device)
        port_findings = [f for f in result.findings if "port" in f.title.lower()]
        assert len(port_findings) > 0


class TestHomeAssistantAuditor:
    """Tests for HomeAssistantAuditor."""

    def test_auditor_properties(self):
        """Test auditor properties."""
        auditor = HomeAssistantAuditor()
        assert "Home Assistant" in auditor.name
        assert len(auditor.checks) > 0

    @pytest.mark.asyncio
    async def test_detect_by_port(self):
        """Test detection by port 8123."""
        auditor = HomeAssistantAuditor()

        # Device with HA port
        device_with_ha = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=8123, service="home_assistant")],
        )
        assert await auditor.detect(device_with_ha) is True

        # Device without HA port
        device_no_ha = Device(
            ip="192.168.1.101",
            open_ports=[PortInfo(port=80, service="http")],
        )
        assert await auditor.detect(device_no_ha) is False

    @pytest.mark.asyncio
    async def test_detect_by_platform(self):
        """Test detection by platform."""
        auditor = HomeAssistantAuditor()

        device = Device(
            ip="192.168.1.100",
            platform=Platform.HOME_ASSISTANT,
        )
        assert await auditor.detect(device) is True


class TestMQTTAuditor:
    """Tests for MQTTAuditor."""

    def test_auditor_properties(self):
        """Test auditor properties."""
        auditor = MQTTAuditor()
        assert "MQTT" in auditor.name
        assert len(auditor.checks) > 0

    @pytest.mark.asyncio
    async def test_detect_by_port(self):
        """Test detection by MQTT ports."""
        auditor = MQTTAuditor()

        # Device with MQTT port
        device_with_mqtt = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=1883, service="mqtt")],
        )
        assert await auditor.detect(device_with_mqtt) is True

        # Device with MQTTS port
        device_with_mqtts = Device(
            ip="192.168.1.101",
            open_ports=[PortInfo(port=8883, service="mqtts")],
        )
        assert await auditor.detect(device_with_mqtts) is True

        # Device without MQTT
        device_no_mqtt = Device(
            ip="192.168.1.102",
            open_ports=[PortInfo(port=80, service="http")],
        )
        assert await auditor.detect(device_no_mqtt) is False

    @pytest.mark.asyncio
    async def test_tls_check(self):
        """Test MQTT TLS check."""
        auditor = MQTTAuditor()

        # Device with only unencrypted MQTT
        device = Device(
            ip="192.168.1.100",
            open_ports=[PortInfo(port=1883, service="mqtt")],
        )

        result = await auditor.audit(device)
        tls_findings = [f for f in result.findings if "tls" in f.title.lower()]
        assert len(tls_findings) > 0
