"""Telegram notification reporter."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

import aiohttp

from ..models import AuditSession, AuditResult, Finding, Severity


class TelegramReporter:
    """Sends audit notifications to Telegram."""

    def __init__(
        self,
        bot_token: str,
        chat_id: str,
        notify_on: Optional[list[str]] = None,
    ):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.notify_on = notify_on or ["critical", "high"]
        self.api_base = f"https://api.telegram.org/bot{bot_token}"

    async def send_message(self, text: str, parse_mode: str = "HTML") -> bool:
        """Send a message to Telegram."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_base}/sendMessage",
                    json={
                        "chat_id": self.chat_id,
                        "text": text,
                        "parse_mode": parse_mode,
                        "disable_web_page_preview": True,
                    },
                    timeout=aiohttp.ClientTimeout(total=30),
                ) as response:
                    return response.status == 200
        except Exception:
            return False

    async def notify_session_complete(self, session: AuditSession) -> bool:
        """Send notification when audit session completes."""
        # Build message
        score = session.overall_score
        rating = self._get_rating(score)

        critical = len(session.findings_by_severity(Severity.CRITICAL))
        high = len(session.findings_by_severity(Severity.HIGH))
        medium = len(session.findings_by_severity(Severity.MEDIUM))

        emoji = self._score_emoji(score)

        message = f"""
{emoji} <b>SmartHome Security Audit Complete</b>

<b>Overall Score:</b> {score}/100 ({rating})
<b>Devices Scanned:</b> {len(session.audit_results)}

<b>Findings:</b>
🔴 Critical: {critical}
🟠 High: {high}
🟡 Medium: {medium}

"""

        # Add critical findings summary
        if critical > 0 and "critical" in self.notify_on:
            message += "<b>Critical Issues:</b>\n"
            for finding in session.findings_by_severity(Severity.CRITICAL)[:5]:
                message += f"• {finding.title} ({finding.affected_device.ip})\n"

        # Add high findings if enabled
        if high > 0 and "high" in self.notify_on and len(message) < 3500:
            message += "\n<b>High Severity Issues:</b>\n"
            for finding in session.findings_by_severity(Severity.HIGH)[:5]:
                message += f"• {finding.title} ({finding.affected_device.ip})\n"

        message += f"\n<i>Session ID: {session.id}</i>"

        return await self.send_message(message)

    async def notify_finding(self, finding: Finding) -> bool:
        """Send notification for a specific finding."""
        if finding.severity.value not in self.notify_on:
            return True

        emoji = self._severity_emoji(finding.severity)

        message = f"""
{emoji} <b>Security Finding: {finding.title}</b>

<b>Severity:</b> {finding.severity.value.upper()}
<b>Device:</b> {finding.affected_device.display_name}

<b>Description:</b>
{finding.description}

<b>Remediation:</b>
{finding.remediation}
"""

        if finding.evidence:
            message += f"\n<b>Evidence:</b>\n<code>{finding.evidence[:200]}</code>"

        return await self.send_message(message)

    async def notify_scan_complete(self, device_count: int, smart_count: int) -> bool:
        """Send notification when network scan completes."""
        message = f"""
🔍 <b>Network Scan Complete</b>

<b>Total Devices:</b> {device_count}
<b>Smart Home Devices:</b> {smart_count}
"""
        return await self.send_message(message)

    async def notify_error(self, error: str) -> bool:
        """Send error notification."""
        message = f"""
⚠️ <b>Audit Error</b>

{error}
"""
        return await self.send_message(message)

    def _score_emoji(self, score: int) -> str:
        """Get emoji for score."""
        if score >= 90:
            return "🟢"
        elif score >= 75:
            return "🟡"
        elif score >= 50:
            return "🟠"
        else:
            return "🔴"

    def _severity_emoji(self, severity: Severity) -> str:
        """Get emoji for severity."""
        emojis = {
            Severity.CRITICAL: "🚨",
            Severity.HIGH: "🔴",
            Severity.MEDIUM: "🟠",
            Severity.LOW: "🟡",
            Severity.INFO: "ℹ️",
        }
        return emojis.get(severity, "❓")

    def _get_rating(self, score: int) -> str:
        """Get rating from score."""
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

    async def test_connection(self) -> bool:
        """Test Telegram connection."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.api_base}/getMe",
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as response:
                    return response.status == 200
        except Exception:
            return False


async def send_telegram_alert(
    bot_token: str,
    chat_id: str,
    session: AuditSession,
    notify_on: Optional[list[str]] = None,
) -> bool:
    """Convenience function to send Telegram alert."""
    reporter = TelegramReporter(bot_token, chat_id, notify_on)
    return await reporter.notify_session_complete(session)
