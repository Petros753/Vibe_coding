"""CVE checking module for smart home devices."""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Optional

import aiohttp

from ..models import Device, Platform, Severity, Finding
from .database import VulnerabilityDatabase, KnownVulnerability, get_vulnerability_database


class CVEChecker:
    """Checks devices against known CVEs and vulnerabilities."""

    def __init__(self, use_online: bool = False, timeout: float = 10.0):
        self.use_online = use_online
        self.timeout = timeout
        self.db = get_vulnerability_database()

    async def check_device(self, device: Device) -> list[Finding]:
        """Check a device for known vulnerabilities."""
        findings = []

        # Check local database first
        local_findings = await self._check_local(device)
        findings.extend(local_findings)

        # Optionally check online sources
        if self.use_online:
            online_findings = await self._check_online(device)
            findings.extend(online_findings)

        return findings

    async def _check_local(self, device: Device) -> list[Finding]:
        """Check against local vulnerability database."""
        findings = []

        # Get platform-specific vulnerabilities
        vulns = self.db.get_by_platform(device.platform)

        for vuln in vulns:
            # Check version if available
            if vuln.affected_versions and device.firmware_version:
                affected = self.db.check_version(device.platform, device.firmware_version)
                if vuln in affected:
                    finding = self._vuln_to_finding(vuln, device)
                    findings.append(finding)

            # Check for generic issues (no version required)
            elif not vuln.affected_versions:
                # These are informational/best practice checks
                if vuln.severity in (Severity.INFO, Severity.LOW):
                    finding = self._vuln_to_finding(vuln, device)
                    findings.append(finding)

        return findings

    async def _check_online(self, device: Device) -> list[Finding]:
        """Check online CVE databases (optional, requires internet)."""
        findings = []

        # Only check if we have identifiable information
        if not device.vendor and not device.model:
            return findings

        try:
            # Search NVD (National Vulnerability Database)
            cves = await self._search_nvd(device)
            for cve in cves:
                finding = self._cve_to_finding(cve, device)
                if finding:
                    findings.append(finding)
        except Exception:
            # Online check failed, continue with local only
            pass

        return findings

    async def _search_nvd(self, device: Device) -> list[dict[str, Any]]:
        """Search NVD for CVEs related to device."""
        results = []

        # Build search query
        search_terms = []
        if device.vendor:
            search_terms.append(device.vendor)
        if device.model:
            search_terms.append(device.model)
        if device.platform != Platform.UNKNOWN:
            search_terms.append(device.platform.value)

        if not search_terms:
            return results

        query = " ".join(search_terms)

        try:
            # NVD API (free, no API key required for basic searches)
            url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
            params = {
                "keywordSearch": query,
                "resultsPerPage": 10,
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=self.timeout),
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        vulnerabilities = data.get("vulnerabilities", [])

                        for vuln in vulnerabilities:
                            cve = vuln.get("cve", {})
                            results.append({
                                "id": cve.get("id"),
                                "description": self._get_description(cve),
                                "severity": self._get_severity(cve),
                                "references": self._get_references(cve),
                                "published": cve.get("published"),
                            })

        except Exception:
            pass

        return results

    def _get_description(self, cve: dict[str, Any]) -> str:
        """Extract description from CVE data."""
        descriptions = cve.get("descriptions", [])
        for desc in descriptions:
            if desc.get("lang") == "en":
                return desc.get("value", "")
        return ""

    def _get_severity(self, cve: dict[str, Any]) -> Severity:
        """Extract severity from CVE data."""
        metrics = cve.get("metrics", {})

        # Try CVSS 3.1 first
        cvss31 = metrics.get("cvssMetricV31", [])
        if cvss31:
            base_score = cvss31[0].get("cvssData", {}).get("baseScore", 0)
            return self._score_to_severity(base_score)

        # Try CVSS 3.0
        cvss30 = metrics.get("cvssMetricV30", [])
        if cvss30:
            base_score = cvss30[0].get("cvssData", {}).get("baseScore", 0)
            return self._score_to_severity(base_score)

        # Try CVSS 2.0
        cvss2 = metrics.get("cvssMetricV2", [])
        if cvss2:
            base_score = cvss2[0].get("cvssData", {}).get("baseScore", 0)
            return self._score_to_severity(base_score)

        return Severity.MEDIUM

    def _score_to_severity(self, score: float) -> Severity:
        """Convert CVSS score to severity level."""
        if score >= 9.0:
            return Severity.CRITICAL
        elif score >= 7.0:
            return Severity.HIGH
        elif score >= 4.0:
            return Severity.MEDIUM
        elif score >= 0.1:
            return Severity.LOW
        else:
            return Severity.INFO

    def _get_references(self, cve: dict[str, Any]) -> list[str]:
        """Extract references from CVE data."""
        refs = cve.get("references", [])
        return [r.get("url", "") for r in refs if r.get("url")][:5]

    def _vuln_to_finding(self, vuln: KnownVulnerability, device: Device) -> Finding:
        """Convert vulnerability to finding."""
        refs = vuln.references.copy()
        if vuln.cve:
            refs.append(f"https://nvd.nist.gov/vuln/detail/{vuln.cve}")

        return Finding(
            check_id=f"cve-{vuln.id}",
            title=vuln.name,
            description=vuln.description,
            severity=vuln.severity,
            affected_device=device,
            remediation=vuln.remediation,
            references=refs,
            evidence=f"Affected versions: {vuln.affected_versions}" if vuln.affected_versions else None,
        )

    def _cve_to_finding(self, cve: dict[str, Any], device: Device) -> Optional[Finding]:
        """Convert CVE data to finding."""
        if not cve.get("id"):
            return None

        return Finding(
            check_id=f"cve-{cve['id']}",
            title=f"CVE: {cve['id']}",
            description=cve.get("description", "No description available"),
            severity=cve.get("severity", Severity.MEDIUM),
            affected_device=device,
            remediation="Check vendor advisory for patches and updates",
            references=cve.get("references", []),
            evidence=f"Published: {cve.get('published', 'Unknown')}",
        )


async def check_device_cves(
    device: Device,
    use_online: bool = False,
) -> list[Finding]:
    """Convenience function to check device for CVEs."""
    checker = CVEChecker(use_online=use_online)
    return await checker.check_device(device)
