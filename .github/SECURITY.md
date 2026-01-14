# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: security@kaulbyapp.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 5 business days
- **Resolution Timeline**: Depends on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days

### Security Measures

This project implements:

- **Dependency Scanning**: Automated via Dependabot and npm audit
- **Static Analysis**: CodeQL for JavaScript/TypeScript
- **Secret Detection**: TruffleHog and custom pattern matching
- **OWASP Scanning**: ZAP baseline scans on production
- **License Compliance**: Automated license checking

### Responsible Disclosure

We kindly ask that you:

- Give us reasonable time to fix issues before public disclosure
- Avoid accessing or modifying user data
- Act in good faith to avoid privacy violations

We appreciate your help in keeping Kaulby secure!
