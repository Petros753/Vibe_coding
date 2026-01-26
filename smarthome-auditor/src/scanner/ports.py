"""Port scanning module."""

from __future__ import annotations

import asyncio
import socket
from typing import Optional

from ..models import PortInfo, SMART_HOME_PORTS


# Common ports to scan in quick mode
QUICK_SCAN_PORTS = [
    21, 22, 23, 25, 53, 80, 81, 443, 445, 554,
    1883, 1900, 3000, 3389, 5000, 5353, 5683,
    6668, 6669, 7547, 8000, 8080, 8081, 8123,
    8443, 8883, 9000, 9090, 21063, 49152, 51827, 54321,
]

# Extended ports for deep scan
DEEP_SCAN_PORTS = list(range(1, 1025)) + [
    1883, 1900, 2000, 2222, 3000, 3306, 3389,
    4000, 4443, 5000, 5353, 5432, 5555, 5683,
    6000, 6379, 6668, 6669, 7000, 7547, 8000,
    8008, 8080, 8081, 8082, 8088, 8123, 8181,
    8443, 8883, 8888, 9000, 9090, 9100, 9200,
    10000, 11211, 15672, 21063, 27017, 49152, 51827, 54321,
]


class PortScanner:
    """Scans ports on target hosts."""

    def __init__(self, timeout: float = 1.0, max_concurrent: int = 100):
        self.timeout = timeout
        self.max_concurrent = max_concurrent

    async def scan(
        self,
        ip: str,
        ports: Optional[list[int]] = None,
        quick: bool = True,
    ) -> list[PortInfo]:
        """Scan ports on a host."""
        if ports is None:
            ports = QUICK_SCAN_PORTS if quick else DEEP_SCAN_PORTS

        semaphore = asyncio.Semaphore(self.max_concurrent)
        tasks = [self._check_port(ip, port, semaphore) for port in ports]
        results = await asyncio.gather(*tasks)

        # Filter out None results and sort by port number
        open_ports = [p for p in results if p is not None]
        open_ports.sort(key=lambda x: x.port)

        return open_ports

    async def scan_port(self, ip: str, port: int) -> Optional[PortInfo]:
        """Scan a single port."""
        semaphore = asyncio.Semaphore(1)
        return await self._check_port(ip, port, semaphore)

    async def _check_port(
        self,
        ip: str,
        port: int,
        semaphore: asyncio.Semaphore,
    ) -> Optional[PortInfo]:
        """Check if a single port is open."""
        async with semaphore:
            try:
                _, writer = await asyncio.wait_for(
                    asyncio.open_connection(ip, port),
                    timeout=self.timeout,
                )
                writer.close()
                await writer.wait_closed()

                # Port is open, get service info
                service = self._identify_service(port)
                banner = await self._grab_banner(ip, port)

                return PortInfo(
                    port=port,
                    protocol="tcp",
                    state="open",
                    service=service,
                    banner=banner,
                )

            except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
                return None

    def _identify_service(self, port: int) -> Optional[str]:
        """Identify service by port number."""
        # Check smart home ports first
        if port in SMART_HOME_PORTS:
            return SMART_HOME_PORTS[port]["service"]

        # Common services
        common_services = {
            21: "ftp",
            22: "ssh",
            23: "telnet",
            25: "smtp",
            53: "dns",
            80: "http",
            110: "pop3",
            143: "imap",
            443: "https",
            445: "smb",
            554: "rtsp",
            993: "imaps",
            995: "pop3s",
            3306: "mysql",
            3389: "rdp",
            5432: "postgresql",
            5900: "vnc",
            6379: "redis",
            8080: "http-proxy",
            9000: "http-alt",
            27017: "mongodb",
        }

        return common_services.get(port)

    async def _grab_banner(self, ip: str, port: int) -> Optional[str]:
        """Attempt to grab service banner."""
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(ip, port),
                timeout=self.timeout,
            )

            # Send newline for services that expect input
            writer.write(b"\r\n")
            await writer.drain()

            # Try to read banner
            try:
                banner = await asyncio.wait_for(
                    reader.read(1024),
                    timeout=self.timeout / 2,
                )
                writer.close()
                await writer.wait_closed()

                if banner:
                    # Decode and clean up
                    try:
                        text = banner.decode("utf-8", errors="ignore").strip()
                        # Limit length and remove control characters
                        text = "".join(c for c in text if c.isprintable() or c in "\n\r\t")
                        return text[:256] if text else None
                    except Exception:
                        return None
            except asyncio.TimeoutError:
                writer.close()
                await writer.wait_closed()

        except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
            pass

        return None


class UDPPortScanner:
    """Scans UDP ports (requires root for raw sockets)."""

    def __init__(self, timeout: float = 2.0):
        self.timeout = timeout

    async def scan(self, ip: str, ports: Optional[list[int]] = None) -> list[PortInfo]:
        """Scan UDP ports."""
        if ports is None:
            # Common UDP ports for smart home
            ports = [53, 67, 68, 123, 161, 1900, 5353, 5683]

        results = []
        for port in ports:
            result = await self._check_port(ip, port)
            if result:
                results.append(result)

        return results

    async def _check_port(self, ip: str, port: int) -> Optional[PortInfo]:
        """Check if a UDP port is open."""
        try:
            loop = asyncio.get_event_loop()

            # Create UDP socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(self.timeout)
            sock.setblocking(False)

            # Send probe packet
            await loop.sock_sendto(sock, b"\x00", (ip, port))

            # Try to receive response
            try:
                await asyncio.wait_for(
                    loop.sock_recv(sock, 1024),
                    timeout=self.timeout,
                )
                sock.close()

                return PortInfo(
                    port=port,
                    protocol="udp",
                    state="open",
                    service=self._identify_udp_service(port),
                )

            except (asyncio.TimeoutError, ConnectionRefusedError):
                sock.close()
                # UDP timeout doesn't necessarily mean closed
                return None

        except Exception:
            return None

    def _identify_udp_service(self, port: int) -> Optional[str]:
        """Identify UDP service by port."""
        services = {
            53: "dns",
            67: "dhcp",
            68: "dhcp",
            123: "ntp",
            161: "snmp",
            1900: "ssdp",
            5353: "mdns",
            5683: "coap",
        }
        return services.get(port)
