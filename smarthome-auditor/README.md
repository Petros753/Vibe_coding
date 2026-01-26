# SmartHome Security Auditor

A comprehensive CLI tool for auditing the security of smart home devices and networks.

```
╭─────────────────────────────────────────────────────────╮
│           SmartHome Security Auditor v1.0               │
╰─────────────────────────────────────────────────────────╯
```

## Features

- **Network Discovery**: Automatically discover smart home devices on your network
- **Multi-Platform Support**: Audit Home Assistant, Tuya, Xiaomi, Zigbee, MQTT, and more
- **Security Checks**: Over 40 security checks covering:
  - Authentication vulnerabilities
  - Encryption issues
  - Default credentials
  - Known CVEs
  - Configuration weaknesses
- **Beautiful Reports**: Generate HTML, JSON, or console reports
- **Telegram Alerts**: Get notified of critical findings
- **Extensible**: Easy to add new auditors and checks

## Installation

### Using pip

```bash
pip install smarthome-auditor
```

### From source

```bash
git clone https://github.com/smarthome-security/smarthome-auditor.git
cd smarthome-auditor
pip install -e ".[full]"
```

### Requirements

- Python 3.11+
- Linux, macOS, or Windows
- Some features require root/administrator privileges

## Quick Start

### Scan your network

```bash
# Auto-detect and scan local network
smarthome-audit scan

# Scan specific network
smarthome-audit scan --network 192.168.1.0/24

# Deep scan with more ports
smarthome-audit scan --deep
```

### Audit devices

```bash
# Audit a specific device
smarthome-audit audit 192.168.1.100

# Audit entire network
smarthome-audit audit 192.168.1.0/24

# Generate HTML report
smarthome-audit audit 192.168.1.100 --format html --output report.html

# Deep audit with all checks
smarthome-audit audit 192.168.1.100 --deep
```

### Interactive mode

```bash
smarthome-audit interactive
```

## Example Output

```
[*] Scanning network 192.168.1.0/24...
[+] Found 12 devices, 4 identified as smart home

┌─────────────────────────────────────────────────────────┐
│ Device: Home Assistant (192.168.1.50)                   │
├─────────────────────────────────────────────────────────┤
│ ⚠ MEDIUM: HTTP access enabled (port 8123)               │
│ ✓ OK: Valid SSL certificate                             │
│ ✓ OK: Authentication required                           │
│ ⚠ LOW: 2 integrations with excessive permissions        │
│ ✗ HIGH: Outdated version (2023.1.0, latest: 2024.1.0)   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Device: Tuya Gateway (192.168.1.51)                     │
├─────────────────────────────────────────────────────────┤
│ ✗ CRITICAL: Default credentials (admin/admin)          │
│ ✗ HIGH: Telnet enabled with root access                 │
│ ⚠ MEDIUM: Cloud sync enabled (data leaves network)      │
└─────────────────────────────────────────────────────────┘

Overall Security Score: 45/100 (Poor)
Critical: 1 | High: 2 | Medium: 3 | Low: 1
```

## Supported Platforms

| Platform | Auditor | Checks |
|----------|---------|--------|
| Home Assistant | HomeAssistantAuditor | Version, API auth, SSL, Supervisor |
| Tuya/Smart Life | TuyaAuditor | Local API, cloud sync, encryption |
| Xiaomi Mi Home | XiaomiAuditor | miio protocol, gateway security |
| Zigbee | ZigbeeAuditor | Network key, permit join, pairing |
| MQTT | MQTTAuditor | Anonymous access, TLS, ACLs |
| Generic | GenericAuditor | Ports, credentials, SSL, UPnP |

## Configuration

Create a config file at `~/.smarthome-auditor/config.yaml`:

```yaml
scan:
  timeout: 2.0
  max_concurrent: 100

audit:
  deep_scan: false
  check_credentials: true

telegram:
  enabled: true
  bot_token: "YOUR_BOT_TOKEN"
  chat_id: "YOUR_CHAT_ID"
  notify_on:
    - critical
    - high
```

Or initialize with defaults:

```bash
smarthome-audit config --init
```

## Security Checks

### Authentication
- Default credentials detection
- API authentication requirements
- Weak password policies

### Encryption
- HTTP vs HTTPS
- SSL certificate validity
- Self-signed certificates
- MQTT TLS configuration

### Network
- Open ports analysis
- UPnP configuration
- Telnet/SSH exposure
- CORS misconfiguration

### Platform-Specific
- Home Assistant version vulnerabilities
- Tuya cloud sync risks
- Zigbee network key security
- MQTT broker ACLs

## Ethical Use

This tool is designed for **authorized security testing only**.

- Only scan networks and devices you own or have explicit permission to test
- Unauthorized scanning may violate local laws
- The tool performs read-only operations and does not exploit vulnerabilities
- Credentials are not stored in logs

## Development

### Setup

```bash
git clone https://github.com/smarthome-security/smarthome-auditor.git
cd smarthome-auditor
pip install -e ".[dev]"
```

### Run tests

```bash
pytest
```

### Code style

```bash
black src tests
isort src tests
ruff check src tests
mypy src
```

### Adding a new auditor

1. Create a new file in `src/auditors/`
2. Inherit from `BaseAuditor`
3. Implement `detect()`, `audit()`, and define `checks`
4. Register with `@register_auditor` decorator
5. Add to `__init__.py` and `main.py`

Example:

```python
from .base import BaseAuditor, register_auditor

@register_auditor
class MyAuditor(BaseAuditor):
    @property
    def name(self) -> str:
        return "My Custom Auditor"

    async def detect(self, device: Device) -> bool:
        return device.has_port(12345)

    async def audit(self, device: Device) -> AuditResult:
        # Perform checks
        pass
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

## Disclaimer

This software is provided for educational and authorized testing purposes only. The authors are not responsible for any misuse or damage caused by this tool. Always obtain proper authorization before scanning any network or device.
