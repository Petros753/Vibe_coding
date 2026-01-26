"""HTML report generator."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Optional

from ..models import AuditSession, AuditResult, Finding, Severity


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartHome Security Audit Report</title>
    <style>
        :root {{
            --bg-color: #1a1a2e;
            --card-bg: #16213e;
            --text-color: #eee;
            --border-color: #0f3460;
            --critical: #ff4757;
            --high: #ff6b6b;
            --medium: #ffa502;
            --low: #1e90ff;
            --info: #17a2b8;
            --success: #2ed573;
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background: var(--bg-color);
            color: var(--text-color);
            line-height: 1.6;
            padding: 20px;
        }}

        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}

        header {{
            text-align: center;
            padding: 40px 0;
            border-bottom: 2px solid var(--border-color);
            margin-bottom: 30px;
        }}

        h1 {{
            font-size: 2.5em;
            margin-bottom: 10px;
            color: #00d9ff;
        }}

        .subtitle {{
            color: #888;
            font-size: 1.1em;
        }}

        .summary-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }}

        .summary-card {{
            background: var(--card-bg);
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            border: 1px solid var(--border-color);
        }}

        .summary-card.score {{
            grid-column: span 2;
        }}

        .score-value {{
            font-size: 3em;
            font-weight: bold;
        }}

        .score-excellent {{ color: var(--success); }}
        .score-good {{ color: #7bed9f; }}
        .score-fair {{ color: var(--medium); }}
        .score-poor {{ color: var(--high); }}
        .score-critical {{ color: var(--critical); }}

        .severity-count {{
            font-size: 2em;
            font-weight: bold;
        }}

        .severity-critical {{ color: var(--critical); }}
        .severity-high {{ color: var(--high); }}
        .severity-medium {{ color: var(--medium); }}
        .severity-low {{ color: var(--low); }}
        .severity-info {{ color: var(--info); }}

        .device-section {{
            background: var(--card-bg);
            border-radius: 10px;
            margin-bottom: 20px;
            border: 1px solid var(--border-color);
            overflow: hidden;
        }}

        .device-header {{
            padding: 20px;
            background: rgba(0, 0, 0, 0.2);
            border-bottom: 1px solid var(--border-color);
        }}

        .device-name {{
            font-size: 1.3em;
            font-weight: bold;
        }}

        .device-info {{
            color: #888;
            font-size: 0.9em;
            margin-top: 5px;
        }}

        .findings-list {{
            padding: 15px;
        }}

        .finding {{
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 8px;
            background: rgba(0, 0, 0, 0.2);
        }}

        .finding:last-child {{
            margin-bottom: 0;
        }}

        .finding-header {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 10px;
        }}

        .severity-badge {{
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: bold;
            text-transform: uppercase;
        }}

        .badge-critical {{ background: var(--critical); }}
        .badge-high {{ background: var(--high); }}
        .badge-medium {{ background: var(--medium); color: #000; }}
        .badge-low {{ background: var(--low); }}
        .badge-info {{ background: var(--info); }}

        .finding-title {{
            font-weight: bold;
        }}

        .finding-description {{
            color: #aaa;
            margin-bottom: 10px;
        }}

        .finding-remediation {{
            background: rgba(46, 213, 115, 0.1);
            border-left: 3px solid var(--success);
            padding: 10px;
            margin-top: 10px;
        }}

        .finding-remediation h4 {{
            color: var(--success);
            margin-bottom: 5px;
        }}

        .passed-check {{
            color: var(--success);
            padding: 8px 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}

        .passed-check::before {{
            content: "✓";
        }}

        footer {{
            text-align: center;
            padding: 30px;
            color: #666;
            border-top: 1px solid var(--border-color);
            margin-top: 30px;
        }}

        .references {{
            margin-top: 10px;
        }}

        .references a {{
            color: #00d9ff;
            text-decoration: none;
        }}

        .references a:hover {{
            text-decoration: underline;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🔒 SmartHome Security Audit Report</h1>
            <p class="subtitle">Generated on {generated_date}</p>
        </header>

        <div class="summary-grid">
            <div class="summary-card score">
                <div class="score-value {score_class}">{score}/100</div>
                <div>Overall Security Score: {rating}</div>
            </div>
            <div class="summary-card">
                <div class="severity-count severity-critical">{critical_count}</div>
                <div>Critical</div>
            </div>
            <div class="summary-card">
                <div class="severity-count severity-high">{high_count}</div>
                <div>High</div>
            </div>
            <div class="summary-card">
                <div class="severity-count severity-medium">{medium_count}</div>
                <div>Medium</div>
            </div>
            <div class="summary-card">
                <div class="severity-count severity-low">{low_count}</div>
                <div>Low</div>
            </div>
        </div>

        <h2 style="margin-bottom: 20px;">📱 Devices Audited</h2>

        {device_sections}

        <footer>
            <p>Report generated by SmartHome Security Auditor v1.0</p>
            <p>This report is for authorized security testing purposes only.</p>
        </footer>
    </div>
</body>
</html>
"""

DEVICE_SECTION_TEMPLATE = """
<div class="device-section">
    <div class="device-header">
        <div class="device-name">{device_name}</div>
        <div class="device-info">
            IP: {ip} | Platform: {platform} | Type: {device_type}
            {vendor_info}
        </div>
    </div>
    <div class="findings-list">
        {findings_html}
        {passed_html}
    </div>
</div>
"""

FINDING_TEMPLATE = """
<div class="finding">
    <div class="finding-header">
        <span class="severity-badge badge-{severity}">{severity_upper}</span>
        <span class="finding-title">{title}</span>
    </div>
    <div class="finding-description">{description}</div>
    {evidence_html}
    <div class="finding-remediation">
        <h4>Remediation</h4>
        <p>{remediation}</p>
    </div>
    {references_html}
</div>
"""


class HTMLReporter:
    """Generates HTML audit reports."""

    def __init__(self, output_path: Optional[str] = None):
        self.output_path = output_path

    def generate(self, session: AuditSession) -> str:
        """Generate HTML report from audit session."""
        # Calculate counts
        critical = len(session.findings_by_severity(Severity.CRITICAL))
        high = len(session.findings_by_severity(Severity.HIGH))
        medium = len(session.findings_by_severity(Severity.MEDIUM))
        low = len(session.findings_by_severity(Severity.LOW))

        score = session.overall_score
        rating = self._get_rating(score)
        score_class = f"score-{rating.lower()}"

        # Generate device sections
        device_sections = []
        for result in session.audit_results:
            section = self._generate_device_section(result)
            device_sections.append(section)

        # Fill template
        html = HTML_TEMPLATE.format(
            generated_date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            score=score,
            score_class=score_class,
            rating=rating,
            critical_count=critical,
            high_count=high,
            medium_count=medium,
            low_count=low,
            device_sections="\n".join(device_sections),
        )

        return html

    def _generate_device_section(self, result: AuditResult) -> str:
        """Generate HTML for a device section."""
        device = result.device

        # Generate findings HTML
        findings_html = []
        for finding in sorted(result.findings, key=lambda f: f.severity.score, reverse=True):
            finding_html = self._generate_finding(finding)
            findings_html.append(finding_html)

        # Generate passed checks HTML
        passed_html = []
        for passed in result.passed_checks:
            passed_html.append(f'<div class="passed-check">{passed.title}</div>')

        vendor_info = f" | Vendor: {device.vendor}" if device.vendor else ""

        return DEVICE_SECTION_TEMPLATE.format(
            device_name=device.display_name,
            ip=device.ip,
            platform=device.platform.value,
            device_type=device.device_type.value,
            vendor_info=vendor_info,
            findings_html="\n".join(findings_html),
            passed_html="\n".join(passed_html),
        )

    def _generate_finding(self, finding: Finding) -> str:
        """Generate HTML for a finding."""
        evidence_html = ""
        if finding.evidence:
            evidence_html = f'<div class="finding-evidence"><code>{finding.evidence}</code></div>'

        references_html = ""
        if finding.references:
            refs = [f'<a href="{ref}" target="_blank">{ref}</a>' for ref in finding.references]
            references_html = f'<div class="references">References: {", ".join(refs)}</div>'

        return FINDING_TEMPLATE.format(
            severity=finding.severity.value,
            severity_upper=finding.severity.value.upper(),
            title=finding.title,
            description=finding.description,
            evidence_html=evidence_html,
            remediation=finding.remediation,
            references_html=references_html,
        )

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

    def save(self, session: AuditSession, path: Optional[str] = None) -> str:
        """Generate and save HTML report."""
        html = self.generate(session)

        output_path = path or self.output_path
        if not output_path:
            output_path = f"audit_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"

        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)

        return str(output_path)
