"""Base auditor class for security checks."""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Optional

from ..models import (
    AuditResult,
    Device,
    Finding,
    PassedCheck,
    SecurityCheck,
    Severity,
    Target,
)


class BaseAuditor(ABC):
    """Base class for all security auditors."""

    def __init__(self, config: Optional[dict[str, Any]] = None):
        self.config = config or {}
        self._findings: list[Finding] = []
        self._passed_checks: list[PassedCheck] = []
        self._skipped_checks: list[str] = []

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of the auditor."""
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """Description of what this auditor checks."""
        pass

    @property
    @abstractmethod
    def checks(self) -> list[SecurityCheck]:
        """List of security checks this auditor performs."""
        pass

    @abstractmethod
    async def detect(self, device: Device) -> bool:
        """
        Detect if this auditor is applicable to the device.

        Returns True if the auditor can check this device.
        """
        pass

    @abstractmethod
    async def audit(self, device: Device) -> AuditResult:
        """
        Perform security audit on the device.

        Returns AuditResult with all findings.
        """
        pass

    def add_finding(
        self,
        check: SecurityCheck,
        device: Device,
        description: str,
        remediation: str,
        evidence: Optional[str] = None,
        references: Optional[list[str]] = None,
        severity_override: Optional[Severity] = None,
    ) -> Finding:
        """Add a security finding."""
        finding = Finding(
            check_id=check.id,
            title=check.name,
            description=description,
            severity=severity_override or check.severity_if_failed,
            affected_device=device,
            remediation=remediation,
            evidence=evidence,
            references=references or [],
        )
        self._findings.append(finding)
        return finding

    def add_passed(self, check: SecurityCheck, device: Device) -> PassedCheck:
        """Mark a check as passed."""
        passed = PassedCheck(
            check_id=check.id,
            title=check.name,
            device=device,
        )
        self._passed_checks.append(passed)
        return passed

    def skip_check(self, check: SecurityCheck, reason: str = "") -> None:
        """Mark a check as skipped."""
        self._skipped_checks.append(f"{check.id}: {reason}" if reason else check.id)

    def _reset(self) -> None:
        """Reset internal state for new audit."""
        self._findings = []
        self._passed_checks = []
        self._skipped_checks = []

    def _create_result(self, device: Device, start_time: datetime) -> AuditResult:
        """Create audit result from current state."""
        return AuditResult(
            device=device,
            auditor_name=self.name,
            findings=self._findings.copy(),
            passed_checks=self._passed_checks.copy(),
            skipped_checks=self._skipped_checks.copy(),
            start_time=start_time,
            end_time=datetime.now(),
        )


class AuditorRegistry:
    """Registry for all available auditors."""

    _auditors: list[type[BaseAuditor]] = []

    @classmethod
    def register(cls, auditor_class: type[BaseAuditor]) -> type[BaseAuditor]:
        """Register an auditor class."""
        if auditor_class not in cls._auditors:
            cls._auditors.append(auditor_class)
        return auditor_class

    @classmethod
    def get_all(cls) -> list[type[BaseAuditor]]:
        """Get all registered auditors."""
        return cls._auditors.copy()

    @classmethod
    async def get_applicable(cls, device: Device) -> list[BaseAuditor]:
        """Get auditors applicable to a device."""
        applicable = []
        for auditor_class in cls._auditors:
            auditor = auditor_class()
            if await auditor.detect(device):
                applicable.append(auditor)
        return applicable


def register_auditor(cls: type[BaseAuditor]) -> type[BaseAuditor]:
    """Decorator to register an auditor."""
    return AuditorRegistry.register(cls)


# Re-export for convenience
__all__ = [
    "BaseAuditor",
    "AuditorRegistry",
    "register_auditor",
    "SecurityCheck",
    "AuditResult",
    "Finding",
    "PassedCheck",
]
