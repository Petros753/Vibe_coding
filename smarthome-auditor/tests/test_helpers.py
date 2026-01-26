"""Tests for helper utilities."""

import pytest

from src.utils.helpers import (
    validate_ip,
    validate_network,
    mac_to_vendor,
    format_mac,
    is_private_ip,
    get_network_hosts,
    bytes_to_human,
    seconds_to_human,
    sanitize_string,
)


class TestIPValidation:
    """Tests for IP validation."""

    def test_valid_ips(self):
        """Test valid IP addresses."""
        assert validate_ip("192.168.1.1") is True
        assert validate_ip("10.0.0.1") is True
        assert validate_ip("172.16.0.1") is True
        assert validate_ip("8.8.8.8") is True

    def test_invalid_ips(self):
        """Test invalid IP addresses."""
        assert validate_ip("invalid") is False
        assert validate_ip("256.1.1.1") is False
        assert validate_ip("192.168.1") is False
        assert validate_ip("") is False


class TestNetworkValidation:
    """Tests for network validation."""

    def test_valid_networks(self):
        """Test valid network CIDRs."""
        assert validate_network("192.168.1.0/24") is True
        assert validate_network("10.0.0.0/8") is True
        assert validate_network("172.16.0.0/16") is True

    def test_invalid_networks(self):
        """Test invalid network CIDRs."""
        assert validate_network("invalid") is False
        assert validate_network("192.168.1.0/33") is False
        assert validate_network("192.168.1.0") is False


class TestMACVendor:
    """Tests for MAC to vendor lookup."""

    def test_known_vendors(self):
        """Test known vendor lookups."""
        assert mac_to_vendor("00:17:88:XX:XX:XX") is not None  # Philips
        assert mac_to_vendor("24:62:AB:XX:XX:XX") is not None  # Espressif

    def test_unknown_vendor(self):
        """Test unknown vendor."""
        assert mac_to_vendor("FF:FF:FF:XX:XX:XX") is None

    def test_empty_mac(self):
        """Test empty MAC."""
        assert mac_to_vendor("") is None
        assert mac_to_vendor(None) is None


class TestMACFormatting:
    """Tests for MAC formatting."""

    def test_format_mac(self):
        """Test MAC address formatting."""
        assert format_mac("00:11:22:33:44:55") == "00:11:22:33:44:55"
        assert format_mac("00-11-22-33-44-55") == "00:11:22:33:44:55"
        assert format_mac("001122334455") == "00:11:22:33:44:55"

    def test_format_empty_mac(self):
        """Test formatting empty MAC."""
        assert format_mac("") == ""


class TestPrivateIP:
    """Tests for private IP detection."""

    def test_private_ips(self):
        """Test private IP detection."""
        assert is_private_ip("192.168.1.1") is True
        assert is_private_ip("10.0.0.1") is True
        assert is_private_ip("172.16.0.1") is True

    def test_public_ips(self):
        """Test public IP detection."""
        assert is_private_ip("8.8.8.8") is False
        assert is_private_ip("1.1.1.1") is False

    def test_invalid_ip(self):
        """Test invalid IP."""
        assert is_private_ip("invalid") is False


class TestNetworkHosts:
    """Tests for network host enumeration."""

    def test_get_hosts(self):
        """Test getting hosts from network."""
        hosts = get_network_hosts("192.168.1.0/30")
        assert len(hosts) == 2  # /30 has 2 usable hosts

        hosts = get_network_hosts("192.168.1.0/24")
        assert len(hosts) == 254  # /24 has 254 usable hosts

    def test_invalid_network(self):
        """Test invalid network."""
        hosts = get_network_hosts("invalid")
        assert hosts == []


class TestBytesToHuman:
    """Tests for bytes to human readable conversion."""

    def test_bytes(self):
        """Test byte conversion."""
        assert bytes_to_human(500) == "500.0 B"

    def test_kilobytes(self):
        """Test kilobyte conversion."""
        assert bytes_to_human(1024) == "1.0 KB"
        assert bytes_to_human(2048) == "2.0 KB"

    def test_megabytes(self):
        """Test megabyte conversion."""
        assert bytes_to_human(1024 * 1024) == "1.0 MB"

    def test_gigabytes(self):
        """Test gigabyte conversion."""
        assert bytes_to_human(1024 * 1024 * 1024) == "1.0 GB"


class TestSecondsToHuman:
    """Tests for seconds to human readable conversion."""

    def test_seconds(self):
        """Test second conversion."""
        assert seconds_to_human(30) == "30.0s"

    def test_minutes(self):
        """Test minute conversion."""
        assert seconds_to_human(90) == "1.5m"

    def test_hours(self):
        """Test hour conversion."""
        assert seconds_to_human(3600) == "1.0h"
        assert seconds_to_human(7200) == "2.0h"


class TestSanitizeString:
    """Tests for string sanitization."""

    def test_sanitize_password(self):
        """Test password sanitization."""
        text = 'password="secret123"'
        sanitized = sanitize_string(text)
        assert "secret123" not in sanitized
        assert "MASKED" in sanitized

    def test_sanitize_token(self):
        """Test token sanitization."""
        text = 'token: abc123xyz'
        sanitized = sanitize_string(text)
        assert "abc123xyz" not in sanitized
        assert "MASKED" in sanitized

    def test_sanitize_api_key(self):
        """Test API key sanitization."""
        text = 'api_key=myapikey123'
        sanitized = sanitize_string(text)
        assert "myapikey123" not in sanitized

    def test_normal_text_unchanged(self):
        """Test that normal text is unchanged."""
        text = "This is normal text without secrets"
        sanitized = sanitize_string(text)
        assert sanitized == text
