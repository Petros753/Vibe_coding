"""Network scanning module for device discovery."""

from __future__ import annotations

import asyncio
import socket
from datetime import datetime
from ipaddress import IPv4Network
from typing import Optional

from ..models import Device, DeviceType, Platform, ScanResult, OUI_DATABASE, SMART_HOME_PORTS
from ..utils.helpers import (
    get_default_network,
    mac_to_vendor,
    resolve_hostname,
    is_private_ip,
)
from .ports import PortScanner
from .services import ServiceDetector


class NetworkScanner:
    """Scans network for smart home devices."""

    def __init__(
        self,
        timeout: float = 2.0,
        max_concurrent: int = 100,
        resolve_hostnames: bool = True,
    ):
        self.timeout = timeout
        self.max_concurrent = max_concurrent
        self.resolve_hostnames = resolve_hostnames
        self.port_scanner = PortScanner(timeout=timeout)
        self.service_detector = ServiceDetector()

    async def scan(
        self,
        network: Optional[str] = None,
        quick: bool = True,
    ) -> ScanResult:
        """Scan network for devices."""
        if network is None:
            network = get_default_network()
            if not network:
                raise RuntimeError("Could not determine network to scan")

        start_time = datetime.now()
        result = ScanResult(network=network, scan_type="quick" if quick else "deep")

        # Get all hosts in network
        try:
            net = IPv4Network(network, strict=False)
            hosts = [str(host) for host in net.hosts()]
        except ValueError as e:
            raise ValueError(f"Invalid network: {network}") from e

        # Limit network size for safety
        if len(hosts) > 1024:
            raise ValueError(f"Network too large ({len(hosts)} hosts). Use /22 or smaller.")

        # Scan hosts concurrently with semaphore
        semaphore = asyncio.Semaphore(self.max_concurrent)
        tasks = [self._scan_host(ip, semaphore, quick) for ip in hosts]
        devices = await asyncio.gather(*tasks)

        # Filter out None results
        result.devices = [d for d in devices if d is not None]

        # Identify smart home devices
        result.smart_home_devices = [
            d for d in result.devices
            if self._is_smart_home_device(d)
        ]

        result.end_time = datetime.now()
        return result

    async def scan_host(self, ip: str, deep: bool = False) -> Optional[Device]:
        """Scan a single host."""
        semaphore = asyncio.Semaphore(1)
        return await self._scan_host(ip, semaphore, not deep)

    async def _scan_host(
        self,
        ip: str,
        semaphore: asyncio.Semaphore,
        quick: bool,
    ) -> Optional[Device]:
        """Scan a single host with semaphore."""
        async with semaphore:
            # Quick ping check
            if not await self._is_host_up(ip):
                return None

            device = Device(ip=ip)

            # Resolve hostname
            if self.resolve_hostnames:
                hostname = await asyncio.to_thread(resolve_hostname, ip)
                if hostname:
                    device.hostname = hostname

            # Get MAC address (requires ARP cache or root)
            mac = await self._get_mac_address(ip)
            if mac:
                device.mac = mac
                device.vendor = mac_to_vendor(mac)

            # Scan ports
            ports = await self.port_scanner.scan(ip, quick=quick)
            device.open_ports = ports

            # Detect services and platform
            if ports:
                services = await self.service_detector.detect(device)
                device.services = services

                # Identify device type and platform
                device.device_type = self._identify_device_type(device)
                device.platform = self._identify_platform(device)

            return device

    async def _is_host_up(self, ip: str) -> bool:
        """Check if host is up using TCP connect."""
        # Try common ports quickly
        quick_ports = [80, 443, 22, 8123, 1883]

        for port in quick_ports:
            try:
                _, writer = await asyncio.wait_for(
                    asyncio.open_connection(ip, port),
                    timeout=self.timeout / 2,
                )
                writer.close()
                await writer.wait_closed()
                return True
            except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
                continue

        return False

    async def _get_mac_address(self, ip: str) -> Optional[str]:
        """Get MAC address from ARP cache."""
        try:
            # Try reading from ARP cache
            with open("/proc/net/arp", "r") as f:
                for line in f:
                    if ip in line:
                        parts = line.split()
                        if len(parts) >= 4:
                            mac = parts[3]
                            if mac != "00:00:00:00:00:00":
                                return mac.upper()
        except (FileNotFoundError, PermissionError):
            pass

        return None

    def _is_smart_home_device(self, device: Device) -> bool:
        """Check if device appears to be a smart home device."""
        # Check vendor
        smart_vendors = [
            "Espressif", "Xiaomi", "Tuya", "Philips", "Nest",
            "Google", "Amazon", "Hikvision", "Honeywell", "eQ-3"
        ]
        if device.vendor and any(v.lower() in device.vendor.lower() for v in smart_vendors):
            return True

        # Check for smart home ports
        smart_ports = {8123, 1883, 8883, 6668, 6669, 54321, 21063, 51827}
        if any(p.port in smart_ports for p in device.open_ports):
            return True

        # Check hostname patterns
        if device.hostname:
            patterns = [
                "home", "hub", "gateway", "bridge", "smart",
                "nest", "echo", "google", "alexa", "hue",
                "xiaomi", "tuya", "mqtt", "zigbee", "zwave",
            ]
            hostname_lower = device.hostname.lower()
            if any(p in hostname_lower for p in patterns):
                return True

        return False

    def _identify_device_type(self, device: Device) -> DeviceType:
        """Identify device type based on characteristics."""
        # Check for hub/gateway indicators
        if device.has_port(8123):
            return DeviceType.HUB
        if device.has_port(1883) or device.has_port(8883):
            return DeviceType.HUB
        if device.has_port(21063) or device.has_port(51827):
            return DeviceType.BRIDGE

        # Check vendor-specific
        if device.vendor:
            vendor_lower = device.vendor.lower()
            if "hikvision" in vendor_lower:
                return DeviceType.CAMERA
            if "nest" in vendor_lower:
                return DeviceType.THERMOSTAT
            if "philips" in vendor_lower:
                return DeviceType.BRIDGE

        # Check hostname
        if device.hostname:
            hostname_lower = device.hostname.lower()
            if "camera" in hostname_lower or "cam" in hostname_lower:
                return DeviceType.CAMERA
            if "hub" in hostname_lower or "gateway" in hostname_lower:
                return DeviceType.HUB
            if "bridge" in hostname_lower:
                return DeviceType.BRIDGE
            if "thermostat" in hostname_lower:
                return DeviceType.THERMOSTAT
            if "speaker" in hostname_lower or "echo" in hostname_lower:
                return DeviceType.SPEAKER

        return DeviceType.UNKNOWN

    def _identify_platform(self, device: Device) -> Platform:
        """Identify smart home platform."""
        # Check ports
        if device.has_port(8123):
            return Platform.HOME_ASSISTANT

        if device.has_port(6668) or device.has_port(6669):
            return Platform.TUYA

        if device.has_port(54321):
            return Platform.XIAOMI

        if device.has_port(21063) or device.has_port(51827):
            return Platform.HOMEKIT

        if device.has_port(1883) or device.has_port(8883):
            return Platform.MQTT

        # Check vendor
        if device.vendor:
            vendor_lower = device.vendor.lower()
            if "xiaomi" in vendor_lower:
                return Platform.XIAOMI
            if "tuya" in vendor_lower:
                return Platform.TUYA
            if "google" in vendor_lower:
                return Platform.GOOGLE_HOME
            if "amazon" in vendor_lower:
                return Platform.ALEXA

        # Check services
        if "home_assistant" in device.services:
            return Platform.HOME_ASSISTANT
        if "mqtt" in device.services:
            return Platform.MQTT

        return Platform.UNKNOWN


async def quick_scan(network: Optional[str] = None) -> ScanResult:
    """Convenience function for quick network scan."""
    scanner = NetworkScanner()
    return await scanner.scan(network=network, quick=True)


async def deep_scan(network: Optional[str] = None) -> ScanResult:
    """Convenience function for deep network scan."""
    scanner = NetworkScanner()
    return await scanner.scan(network=network, quick=False)
