"""Helper utilities for SmartHome Security Auditor."""

from __future__ import annotations

import os
import socket
import struct
import fcntl
from ipaddress import IPv4Address, IPv4Network
from typing import Optional

from ..models import OUI_DATABASE


def is_root() -> bool:
    """Check if running as root."""
    return os.geteuid() == 0


def get_local_ip() -> Optional[str]:
    """Get the local IP address of the machine."""
    try:
        # Create a socket to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def get_network_interfaces() -> list[dict[str, str]]:
    """Get list of network interfaces with their IPs."""
    interfaces = []

    try:
        import netifaces
        for iface in netifaces.interfaces():
            addrs = netifaces.ifaddresses(iface)
            if netifaces.AF_INET in addrs:
                for addr in addrs[netifaces.AF_INET]:
                    if "addr" in addr and not addr["addr"].startswith("127."):
                        interfaces.append({
                            "name": iface,
                            "ip": addr["addr"],
                            "netmask": addr.get("netmask", "255.255.255.0"),
                        })
    except ImportError:
        # Fallback if netifaces not available
        local_ip = get_local_ip()
        if local_ip:
            interfaces.append({
                "name": "default",
                "ip": local_ip,
                "netmask": "255.255.255.0",
            })

    return interfaces


def get_default_network() -> Optional[str]:
    """Get the default network in CIDR notation."""
    interfaces = get_network_interfaces()
    if not interfaces:
        return None

    iface = interfaces[0]
    ip = iface["ip"]
    netmask = iface["netmask"]

    try:
        # Convert netmask to CIDR prefix
        netmask_int = struct.unpack(">I", socket.inet_aton(netmask))[0]
        prefix = bin(netmask_int).count("1")

        # Calculate network address
        ip_int = struct.unpack(">I", socket.inet_aton(ip))[0]
        network_int = ip_int & netmask_int
        network_ip = socket.inet_ntoa(struct.pack(">I", network_int))

        return f"{network_ip}/{prefix}"
    except Exception:
        return f"{ip}/24"


def mac_to_vendor(mac: str) -> Optional[str]:
    """Look up vendor from MAC address using OUI database."""
    if not mac:
        return None

    # Normalize MAC address
    mac = mac.upper().replace("-", ":").replace(".", ":")

    # Get OUI (first 3 octets)
    parts = mac.split(":")
    if len(parts) < 3:
        return None

    oui = ":".join(parts[:3])
    return OUI_DATABASE.get(oui)


def validate_ip(ip: str) -> bool:
    """Validate IP address format."""
    try:
        IPv4Address(ip)
        return True
    except ValueError:
        return False


def validate_network(network: str) -> bool:
    """Validate network CIDR format."""
    try:
        IPv4Network(network, strict=False)
        return True
    except ValueError:
        return False


def format_mac(mac: str) -> str:
    """Format MAC address to standard notation."""
    if not mac:
        return ""

    # Remove common separators and convert to uppercase
    clean = mac.upper().replace("-", "").replace(":", "").replace(".", "")

    if len(clean) != 12:
        return mac

    # Format as XX:XX:XX:XX:XX:XX
    return ":".join(clean[i:i+2] for i in range(0, 12, 2))


def is_private_ip(ip: str) -> bool:
    """Check if IP address is private."""
    try:
        addr = IPv4Address(ip)
        return addr.is_private
    except ValueError:
        return False


def get_network_hosts(network: str) -> list[str]:
    """Get all host IPs in a network (excluding network and broadcast)."""
    try:
        net = IPv4Network(network, strict=False)
        return [str(host) for host in net.hosts()]
    except ValueError:
        return []


def port_is_open(ip: str, port: int, timeout: float = 1.0) -> bool:
    """Quick check if a port is open."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()
        return result == 0
    except Exception:
        return False


def resolve_hostname(ip: str) -> Optional[str]:
    """Resolve IP to hostname."""
    try:
        return socket.gethostbyaddr(ip)[0]
    except Exception:
        return None


def sanitize_string(s: str) -> str:
    """Sanitize string for safe logging (remove sensitive data patterns)."""
    import re

    # Patterns to mask
    patterns = [
        (r'(password["\s:=]+)[^\s,"]+', r'\1***MASKED***'),
        (r'(token["\s:=]+)[^\s,"]+', r'\1***MASKED***'),
        (r'(api_key["\s:=]+)[^\s,"]+', r'\1***MASKED***'),
        (r'(secret["\s:=]+)[^\s,"]+', r'\1***MASKED***'),
    ]

    result = s
    for pattern, replacement in patterns:
        result = re.sub(pattern, replacement, result, flags=re.IGNORECASE)

    return result


def bytes_to_human(size: int) -> str:
    """Convert bytes to human-readable format."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"


def seconds_to_human(seconds: float) -> str:
    """Convert seconds to human-readable format."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.1f}h"
