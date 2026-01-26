"""JSON report generator."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from ..models import AuditSession, AuditResult, Finding, ScanResult, Severity


class JSONReporter:
    """Generates JSON audit reports."""

    def __init__(self, output_path: Optional[str] = None, indent: int = 2):
        self.output_path = output_path
        self.indent = indent

    def generate(self, session: AuditSession) -> dict[str, Any]:
        """Generate JSON report from audit session."""
        return {
            "report": {
                "version": "1.0",
                "generated_at": datetime.now().isoformat(),
                "session_id": session.id,
            },
            "summary": self._generate_summary(session),
            "scan_result": self._serialize_scan_result(session.scan_result) if session.scan_result else None,
            "audit_results": [
                self._serialize_audit_result(r) for r in session.audit_results
            ],
        }

    def _generate_summary(self, session: AuditSession) -> dict[str, Any]:
        """Generate summary section."""
        return {
            "overall_score": session.overall_score,
            "rating": self._get_rating(session.overall_score),
            "total_devices": len(session.audit_results),
            "total_findings": session.total_findings,
            "findings_by_severity": {
                "critical": len(session.findings_by_severity(Severity.CRITICAL)),
                "high": len(session.findings_by_severity(Severity.HIGH)),
                "medium": len(session.findings_by_severity(Severity.MEDIUM)),
                "low": len(session.findings_by_severity(Severity.LOW)),
                "info": len(session.findings_by_severity(Severity.INFO)),
            },
            "start_time": session.start_time.isoformat() if session.start_time else None,
            "end_time": session.end_time.isoformat() if session.end_time else None,
        }

    def _serialize_scan_result(self, scan: ScanResult) -> dict[str, Any]:
        """Serialize scan result."""
        return {
            "network": scan.network,
            "scan_type": scan.scan_type,
            "total_devices": scan.total_devices,
            "smart_home_devices": scan.smart_home_count,
            "start_time": scan.start_time.isoformat() if scan.start_time else None,
            "end_time": scan.end_time.isoformat() if scan.end_time else None,
            "devices": [self._serialize_device(d) for d in scan.devices],
        }

    def _serialize_device(self, device) -> dict[str, Any]:
        """Serialize device."""
        return {
            "ip": device.ip,
            "mac": device.mac,
            "hostname": device.hostname,
            "vendor": device.vendor,
            "device_type": device.device_type.value,
            "platform": device.platform.value,
            "model": device.model,
            "firmware_version": device.firmware_version,
            "open_ports": [
                {
                    "port": p.port,
                    "protocol": p.protocol,
                    "service": p.service,
                    "state": p.state,
                }
                for p in device.open_ports
            ],
            "services": device.services,
        }

    def _serialize_audit_result(self, result: AuditResult) -> dict[str, Any]:
        """Serialize audit result."""
        return {
            "device": self._serialize_device(result.device),
            "auditor": result.auditor_name,
            "score": result.security_score,
            "rating": result.score_rating,
            "start_time": result.start_time.isoformat() if result.start_time else None,
            "end_time": result.end_time.isoformat() if result.end_time else None,
            "findings": [self._serialize_finding(f) for f in result.findings],
            "passed_checks": [
                {
                    "check_id": p.check_id,
                    "title": p.title,
                }
                for p in result.passed_checks
            ],
            "skipped_checks": result.skipped_checks,
            "summary": {
                "critical": result.critical_count,
                "high": result.high_count,
                "medium": result.medium_count,
                "low": result.low_count,
                "info": result.info_count,
            },
        }

    def _serialize_finding(self, finding: Finding) -> dict[str, Any]:
        """Serialize finding."""
        return {
            "check_id": finding.check_id,
            "title": finding.title,
            "description": finding.description,
            "severity": finding.severity.value,
            "severity_score": finding.severity.score,
            "affected_device": {
                "ip": finding.affected_device.ip,
                "hostname": finding.affected_device.hostname,
            },
            "remediation": finding.remediation,
            "evidence": finding.evidence,
            "references": finding.references,
            "timestamp": finding.timestamp.isoformat() if finding.timestamp else None,
        }

    def _get_rating(self, score: int) -> str:
        """Get rating from score."""
        if score >= 90:
            return "excellent"
        elif score >= 75:
            return "good"
        elif score >= 50:
            return "fair"
        elif score >= 25:
            return "poor"
        else:
            return "critical"

    def to_json(self, session: AuditSession) -> str:
        """Generate JSON string from audit session."""
        data = self.generate(session)
        return json.dumps(data, indent=self.indent, ensure_ascii=False)

    def save(self, session: AuditSession, path: Optional[str] = None) -> str:
        """Generate and save JSON report."""
        json_str = self.to_json(session)

        output_path = path or self.output_path
        if not output_path:
            output_path = f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(json_str)

        return str(output_path)


def export_findings_csv(session: AuditSession, path: str) -> str:
    """Export findings to CSV format."""
    import csv

    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)

        # Header
        writer.writerow([
            "Device IP",
            "Device Hostname",
            "Severity",
            "Finding Title",
            "Description",
            "Remediation",
            "Check ID",
            "Timestamp",
        ])

        # Findings
        for result in session.audit_results:
            for finding in result.findings:
                writer.writerow([
                    finding.affected_device.ip,
                    finding.affected_device.hostname or "",
                    finding.severity.value.upper(),
                    finding.title,
                    finding.description,
                    finding.remediation,
                    finding.check_id,
                    finding.timestamp.isoformat() if finding.timestamp else "",
                ])

    return str(output_path)
