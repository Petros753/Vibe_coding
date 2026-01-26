"""Console reporter with Rich formatting."""

from __future__ import annotations

from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.tree import Tree
from rich.style import Style
from rich.box import ROUNDED

from ..models import (
    AuditResult,
    AuditSession,
    Device,
    Finding,
    ScanResult,
    Severity,
)


class ConsoleReporter:
    """Reports audit results to console with Rich formatting."""

    def __init__(self, console: Optional[Console] = None, verbose: bool = False):
        self.console = console or Console()
        self.verbose = verbose

    def print_banner(self) -> None:
        """Print application banner."""
        banner = Panel(
            "[bold cyan]SmartHome Security Auditor[/bold cyan] v1.0\n"
            "[dim]Comprehensive security scanning for smart home devices[/dim]",
            box=ROUNDED,
            padding=(1, 2),
        )
        self.console.print(banner)
        self.console.print()

    def print_warning(self) -> None:
        """Print legal warning."""
        warning = Panel(
            "[yellow]⚠ LEGAL NOTICE[/yellow]\n\n"
            "This tool is intended for authorized security testing only.\n"
            "Only scan networks and devices you own or have permission to test.\n"
            "Unauthorized scanning may violate laws in your jurisdiction.",
            box=ROUNDED,
            style="yellow",
        )
        self.console.print(warning)
        self.console.print()

    def print_scan_start(self, network: str) -> None:
        """Print scan start message."""
        self.console.print(f"[*] Scanning network [cyan]{network}[/cyan]...")

    def print_scan_result(self, result: ScanResult) -> None:
        """Print scan results."""
        duration = ""
        if result.end_time and result.start_time:
            secs = (result.end_time - result.start_time).total_seconds()
            duration = f" in {secs:.1f}s"

        self.console.print(
            f"[+] Found [green]{result.total_devices}[/green] devices, "
            f"[cyan]{result.smart_home_count}[/cyan] identified as smart home{duration}"
        )
        self.console.print()

        if result.devices:
            self._print_device_table(result.devices, result.smart_home_devices)

    def _print_device_table(
        self,
        all_devices: list[Device],
        smart_devices: list[Device],
    ) -> None:
        """Print table of discovered devices."""
        table = Table(
            title="Discovered Devices",
            box=ROUNDED,
            show_header=True,
            header_style="bold magenta",
        )

        table.add_column("IP Address", style="cyan")
        table.add_column("Hostname", style="dim")
        table.add_column("Vendor", style="yellow")
        table.add_column("Type", style="green")
        table.add_column("Platform", style="blue")
        table.add_column("Open Ports", style="dim")

        smart_ips = {d.ip for d in smart_devices}

        for device in all_devices:
            is_smart = device.ip in smart_ips
            ip_style = "bold cyan" if is_smart else "dim"

            ports = ", ".join(str(p.port) for p in device.open_ports[:5])
            if len(device.open_ports) > 5:
                ports += f" (+{len(device.open_ports) - 5})"

            table.add_row(
                Text(device.ip, style=ip_style),
                device.hostname or "-",
                device.vendor or "-",
                device.device_type.value,
                device.platform.value,
                ports or "-",
            )

        self.console.print(table)
        self.console.print()

    def print_audit_start(self, device: Device) -> None:
        """Print audit start message."""
        self.console.print(
            f"\n[*] Auditing [cyan]{device.display_name}[/cyan]..."
        )

    def print_audit_result(self, result: AuditResult) -> None:
        """Print audit results for a device."""
        # Device panel header
        device = result.device
        platform_info = f" [{device.platform.value}]" if device.platform.value != "unknown" else ""

        header = f"[bold]Device: {device.display_name}[/bold]{platform_info}"

        # Build content
        lines = []

        # Findings
        for finding in sorted(result.findings, key=lambda f: f.severity.score, reverse=True):
            severity = finding.severity
            icon = "✗" if severity in (Severity.CRITICAL, Severity.HIGH) else "⚠"
            lines.append(
                f"[{severity.color}]{icon} {severity.value.upper()}:[/{severity.color}] "
                f"{finding.title}"
            )
            if self.verbose:
                lines.append(f"   [dim]{finding.description}[/dim]")

        # Passed checks
        for passed in result.passed_checks:
            lines.append(f"[green]✓ OK:[/green] {passed.title}")

        if not lines:
            lines.append("[dim]No checks performed[/dim]")

        content = "\n".join(lines)

        panel = Panel(
            content,
            title=header,
            box=ROUNDED,
            padding=(0, 1),
        )
        self.console.print(panel)

    def print_session_summary(self, session: AuditSession) -> None:
        """Print overall session summary."""
        self.console.print()

        # Count findings by severity
        critical = len(session.findings_by_severity(Severity.CRITICAL))
        high = len(session.findings_by_severity(Severity.HIGH))
        medium = len(session.findings_by_severity(Severity.MEDIUM))
        low = len(session.findings_by_severity(Severity.LOW))

        # Score panel
        score = session.overall_score
        rating = self._get_rating(score)

        score_color = self._score_color(score)
        score_text = f"[{score_color}]{score}/100 ({rating})[/{score_color}]"

        summary = Panel(
            f"Overall Security Score: {score_text}\n\n"
            f"[red]Critical: {critical}[/red] | "
            f"[red]High: {high}[/red] | "
            f"[yellow]Medium: {medium}[/yellow] | "
            f"[blue]Low: {low}[/blue]",
            title="[bold]Summary[/bold]",
            box=ROUNDED,
        )
        self.console.print(summary)

    def _get_rating(self, score: int) -> str:
        """Get rating text from score."""
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

    def _score_color(self, score: int) -> str:
        """Get color for score."""
        if score >= 75:
            return "green"
        elif score >= 50:
            return "yellow"
        else:
            return "red"

    def print_finding_details(self, finding: Finding) -> None:
        """Print detailed finding information."""
        severity = finding.severity

        self.console.print(f"\n[{severity.color}]{'=' * 60}[/{severity.color}]")
        self.console.print(f"[{severity.color}][bold]{finding.title}[/bold][/{severity.color}]")
        self.console.print(f"[{severity.color}]{'=' * 60}[/{severity.color}]")

        self.console.print(f"\n[bold]Severity:[/bold] [{severity.color}]{severity.value.upper()}[/{severity.color}]")
        self.console.print(f"[bold]Device:[/bold] {finding.affected_device.display_name}")
        self.console.print(f"\n[bold]Description:[/bold]\n{finding.description}")

        if finding.evidence:
            self.console.print(f"\n[bold]Evidence:[/bold]\n[dim]{finding.evidence}[/dim]")

        self.console.print(f"\n[bold]Remediation:[/bold]\n[green]{finding.remediation}[/green]")

        if finding.references:
            self.console.print("\n[bold]References:[/bold]")
            for ref in finding.references:
                self.console.print(f"  • [link={ref}]{ref}[/link]")

    def create_progress(self) -> Progress:
        """Create a progress bar for scanning."""
        return Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            console=self.console,
        )

    def print_error(self, message: str) -> None:
        """Print error message."""
        self.console.print(f"[red][!] Error:[/red] {message}")

    def print_info(self, message: str) -> None:
        """Print info message."""
        self.console.print(f"[cyan][*][/cyan] {message}")

    def print_success(self, message: str) -> None:
        """Print success message."""
        self.console.print(f"[green][+][/green] {message}")

    def print_warning_msg(self, message: str) -> None:
        """Print warning message."""
        self.console.print(f"[yellow][!][/yellow] {message}")

    def ask_confirm(self, message: str) -> bool:
        """Ask for confirmation."""
        from rich.prompt import Confirm
        return Confirm.ask(message)
