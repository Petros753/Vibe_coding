#!/usr/bin/env python3
"""SmartHome Security Auditor - CLI Entry Point."""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.prompt import Prompt, Confirm

from .models import AuditSession, Device, Severity
from .scanner import NetworkScanner
from .auditors import (
    GenericAuditor,
    HomeAssistantAuditor,
    TuyaAuditor,
    XiaomiAuditor,
    ZigbeeAuditor,
    MQTTAuditor,
)
from .auditors.base import AuditorRegistry
from .vulnerabilities import CVEChecker
from .reporters import ConsoleReporter, HTMLReporter, JSONReporter, TelegramReporter
from .utils.config import load_config, Config
from .utils.helpers import get_default_network, is_root, validate_ip, validate_network


console = Console()
reporter = ConsoleReporter(console)

# Register all auditors
ALL_AUDITORS = [
    GenericAuditor,
    HomeAssistantAuditor,
    TuyaAuditor,
    XiaomiAuditor,
    ZigbeeAuditor,
    MQTTAuditor,
]


def async_command(f):
    """Decorator to run async functions in click commands."""
    def wrapper(*args, **kwargs):
        return asyncio.run(f(*args, **kwargs))
    return wrapper


@click.group()
@click.option("--config", "-c", type=click.Path(exists=True), help="Path to config file")
@click.option("--verbose", "-v", is_flag=True, help="Verbose output")
@click.option("--quiet", "-q", is_flag=True, help="Quiet mode (minimal output)")
@click.pass_context
def cli(ctx, config: Optional[str], verbose: bool, quiet: bool):
    """
    SmartHome Security Auditor - Comprehensive smart home security scanning.

    This tool helps identify security vulnerabilities in your smart home setup.
    Only use on networks and devices you own or have permission to test.
    """
    ctx.ensure_object(dict)
    ctx.obj["config"] = load_config(config)
    ctx.obj["verbose"] = verbose
    ctx.obj["quiet"] = quiet

    if not quiet:
        reporter.print_banner()
        reporter.print_warning()


@cli.command()
@click.option("--network", "-n", help="Network to scan (CIDR notation, e.g., 192.168.1.0/24)")
@click.option("--deep", "-d", is_flag=True, help="Deep scan (more ports, slower)")
@click.option("--output", "-o", help="Output file for results (JSON)")
@click.pass_context
@async_command
async def scan(ctx, network: Optional[str], deep: bool, output: Optional[str]):
    """
    Scan network for smart home devices.

    Examples:

        smarthome-audit scan

        smarthome-audit scan --network 192.168.1.0/24

        smarthome-audit scan --deep --output devices.json
    """
    config: Config = ctx.obj["config"]
    verbose: bool = ctx.obj["verbose"]

    # Determine network
    if not network:
        network = get_default_network()
        if not network:
            reporter.print_error("Could not determine local network. Please specify with --network")
            sys.exit(1)

    if not validate_network(network):
        reporter.print_error(f"Invalid network: {network}")
        sys.exit(1)

    reporter.print_scan_start(network)

    # Create scanner
    scanner = NetworkScanner(
        timeout=config.scan.timeout,
        max_concurrent=config.scan.max_concurrent,
        resolve_hostnames=config.scan.resolve_hostnames,
    )

    try:
        with reporter.create_progress() as progress:
            task = progress.add_task("Scanning...", total=None)
            result = await scanner.scan(network=network, quick=not deep)
            progress.update(task, completed=True)

        reporter.print_scan_result(result)

        # Save results if output specified
        if output:
            json_reporter = JSONReporter()
            session = AuditSession(scan_result=result)
            json_reporter.save(session, output)
            reporter.print_success(f"Results saved to {output}")

    except Exception as e:
        reporter.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument("target")
@click.option("--deep", "-d", is_flag=True, help="Deep audit with all checks")
@click.option("--format", "-f", "output_format", type=click.Choice(["console", "html", "json"]),
              default="console", help="Output format")
@click.option("--output", "-o", help="Output file path")
@click.option("--notify", type=click.Choice(["telegram"]), help="Send notification")
@click.pass_context
@async_command
async def audit(
    ctx,
    target: str,
    deep: bool,
    output_format: str,
    output: Optional[str],
    notify: Optional[str],
):
    """
    Perform security audit on a specific device or network.

    TARGET can be an IP address or network in CIDR notation.

    Examples:

        smarthome-audit audit 192.168.1.100

        smarthome-audit audit 192.168.1.0/24 --deep

        smarthome-audit audit 192.168.1.100 --format html --output report.html
    """
    config: Config = ctx.obj["config"]
    verbose: bool = ctx.obj["verbose"]

    # Determine if target is IP or network
    is_network = "/" in target

    session = AuditSession()

    try:
        if is_network:
            # Scan network first
            if not validate_network(target):
                reporter.print_error(f"Invalid network: {target}")
                sys.exit(1)

            reporter.print_scan_start(target)

            scanner = NetworkScanner(
                timeout=config.scan.timeout,
                max_concurrent=config.scan.max_concurrent,
            )

            with reporter.create_progress() as progress:
                task = progress.add_task("Scanning network...", total=None)
                scan_result = await scanner.scan(network=target, quick=not deep)
                progress.update(task, completed=True)

            reporter.print_scan_result(scan_result)
            session.scan_result = scan_result

            # Audit each smart home device
            devices_to_audit = scan_result.smart_home_devices
            if not devices_to_audit:
                reporter.print_warning_msg("No smart home devices found to audit")
                return

        else:
            # Single device
            if not validate_ip(target):
                reporter.print_error(f"Invalid IP address: {target}")
                sys.exit(1)

            # Quick scan to get device info
            scanner = NetworkScanner(timeout=config.scan.timeout)
            device = await scanner.scan_host(target, deep=deep)

            if not device:
                reporter.print_error(f"Could not reach device at {target}")
                sys.exit(1)

            devices_to_audit = [device]

        # Audit devices
        for device in devices_to_audit:
            reporter.print_audit_start(device)

            # Get applicable auditors
            auditors = []
            for auditor_class in ALL_AUDITORS:
                auditor = auditor_class()
                if await auditor.detect(device):
                    auditors.append(auditor)

            if not auditors:
                # Use generic auditor at minimum
                auditors = [GenericAuditor()]

            # Run audits
            for auditor in auditors:
                try:
                    result = await auditor.audit(device)
                    session.audit_results.append(result)
                    reporter.print_audit_result(result)
                except Exception as e:
                    reporter.print_error(f"Auditor {auditor.name} failed: {e}")

        session.end_time = datetime.now()

        # Print summary
        reporter.print_session_summary(session)

        # Generate report
        if output_format == "html":
            html_reporter = HTMLReporter()
            path = html_reporter.save(session, output)
            reporter.print_success(f"HTML report saved to {path}")

        elif output_format == "json":
            json_reporter = JSONReporter()
            path = json_reporter.save(session, output)
            reporter.print_success(f"JSON report saved to {path}")

        # Send notification
        if notify == "telegram":
            if config.telegram.bot_token and config.telegram.chat_id:
                tg_reporter = TelegramReporter(
                    config.telegram.bot_token,
                    config.telegram.chat_id,
                    config.telegram.notify_on,
                )
                success = await tg_reporter.notify_session_complete(session)
                if success:
                    reporter.print_success("Telegram notification sent")
                else:
                    reporter.print_error("Failed to send Telegram notification")
            else:
                reporter.print_error("Telegram not configured. Set bot_token and chat_id in config.")

    except Exception as e:
        reporter.print_error(str(e))
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@cli.command()
@click.option("--session-file", "-s", help="Load previous session from JSON file")
@click.option("--format", "-f", "output_format", type=click.Choice(["html", "json"]),
              default="html", help="Output format")
@click.option("--output", "-o", required=True, help="Output file path")
@click.pass_context
def report(ctx, session_file: Optional[str], output_format: str, output: str):
    """
    Generate report from previous audit session.

    Examples:

        smarthome-audit report --session-file session.json --output report.html

        smarthome-audit report -s session.json -f json -o report.json
    """
    import json as json_lib

    if not session_file:
        reporter.print_error("Please specify a session file with --session-file")
        sys.exit(1)

    try:
        with open(session_file, "r") as f:
            data = json_lib.load(f)

        # Reconstruct session (simplified)
        session = AuditSession()
        session.id = data.get("report", {}).get("session_id", "")

        if output_format == "html":
            html_reporter = HTMLReporter()
            # For now, we'll need the full session - simplified export
            reporter.print_error("Full session reconstruction not yet implemented")
            sys.exit(1)

        elif output_format == "json":
            # Just copy the JSON
            with open(output, "w") as f:
                json_lib.dump(data, f, indent=2)
            reporter.print_success(f"JSON report saved to {output}")

    except Exception as e:
        reporter.print_error(f"Failed to generate report: {e}")
        sys.exit(1)


@cli.command()
@click.pass_context
@async_command
async def interactive(ctx):
    """
    Start interactive audit mode.

    Provides a guided interface for scanning and auditing devices.
    """
    config: Config = ctx.obj["config"]

    console.print("\n[bold cyan]Interactive Mode[/bold cyan]\n")

    # Get network
    default_network = get_default_network() or "192.168.1.0/24"
    network = Prompt.ask(
        "Enter network to scan",
        default=default_network,
    )

    if not validate_network(network):
        reporter.print_error("Invalid network format")
        return

    # Scan
    reporter.print_scan_start(network)
    scanner = NetworkScanner(timeout=config.scan.timeout)

    with reporter.create_progress() as progress:
        task = progress.add_task("Scanning...", total=None)
        scan_result = await scanner.scan(network=network, quick=True)
        progress.update(task, completed=True)

    reporter.print_scan_result(scan_result)

    if not scan_result.smart_home_devices:
        console.print("[yellow]No smart home devices found.[/yellow]")
        return

    # Ask which devices to audit
    console.print("\n[bold]Smart home devices found:[/bold]")
    for i, device in enumerate(scan_result.smart_home_devices, 1):
        console.print(f"  {i}. {device.display_name} ({device.platform.value})")

    selection = Prompt.ask(
        "\nSelect devices to audit (comma-separated numbers, or 'all')",
        default="all",
    )

    if selection.lower() == "all":
        devices_to_audit = scan_result.smart_home_devices
    else:
        try:
            indices = [int(x.strip()) - 1 for x in selection.split(",")]
            devices_to_audit = [scan_result.smart_home_devices[i] for i in indices]
        except (ValueError, IndexError):
            reporter.print_error("Invalid selection")
            return

    # Perform audit
    session = AuditSession(scan_result=scan_result)

    for device in devices_to_audit:
        reporter.print_audit_start(device)

        for auditor_class in ALL_AUDITORS:
            auditor = auditor_class()
            if await auditor.detect(device):
                try:
                    result = await auditor.audit(device)
                    session.audit_results.append(result)
                    reporter.print_audit_result(result)
                except Exception as e:
                    reporter.print_error(f"Auditor failed: {e}")

    session.end_time = datetime.now()
    reporter.print_session_summary(session)

    # Ask about report
    if Confirm.ask("\nGenerate detailed report?"):
        output_format = Prompt.ask(
            "Format",
            choices=["html", "json"],
            default="html",
        )
        output_path = Prompt.ask(
            "Output file",
            default=f"audit_report.{output_format}",
        )

        if output_format == "html":
            HTMLReporter().save(session, output_path)
        else:
            JSONReporter().save(session, output_path)

        reporter.print_success(f"Report saved to {output_path}")


@cli.command()
@click.pass_context
def info(ctx):
    """
    Show information about available auditors and checks.
    """
    console.print("\n[bold cyan]Available Auditors[/bold cyan]\n")

    for auditor_class in ALL_AUDITORS:
        auditor = auditor_class()
        console.print(f"[bold]{auditor.name}[/bold]")
        console.print(f"  {auditor.description}")
        console.print(f"  Checks: {len(auditor.checks)}")

        if ctx.obj.get("verbose"):
            for check in auditor.checks:
                severity_color = check.severity_if_failed.color
                console.print(
                    f"    - [{severity_color}]{check.severity_if_failed.value.upper()}[/{severity_color}] "
                    f"{check.name}"
                )
        console.print()


@cli.command()
@click.option("--init", is_flag=True, help="Create default config file")
@click.pass_context
def config(ctx, init: bool):
    """
    Show or initialize configuration.
    """
    if init:
        from .utils.config import save_config, get_default_config_yaml

        config_path = Path.home() / ".smarthome-auditor" / "config.yaml"
        config_path.parent.mkdir(parents=True, exist_ok=True)

        if config_path.exists():
            if not Confirm.ask(f"Config already exists at {config_path}. Overwrite?"):
                return

        with open(config_path, "w") as f:
            f.write(get_default_config_yaml())

        reporter.print_success(f"Config created at {config_path}")

    else:
        cfg: Config = ctx.obj["config"]
        console.print("\n[bold]Current Configuration:[/bold]\n")
        console.print(f"Scan timeout: {cfg.scan.timeout}s")
        console.print(f"Max concurrent: {cfg.scan.max_concurrent}")
        console.print(f"Deep scan: {cfg.audit.deep_scan}")
        console.print(f"Check credentials: {cfg.audit.check_credentials}")
        console.print(f"Telegram enabled: {cfg.telegram.enabled}")
        console.print(f"Output directory: {cfg.output_dir}")


@cli.command()
@click.pass_context
def version(ctx):
    """Show version information."""
    from . import __version__
    console.print(f"SmartHome Security Auditor v{__version__}")


def main():
    """Main entry point."""
    try:
        cli(obj={})
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        sys.exit(130)
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main()
