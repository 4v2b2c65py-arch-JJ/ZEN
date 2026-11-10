# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

Please disclose security vulnerabilities responsibly. Do not open public issues for security bugs.

Email: security@jj-model.local

Include:
- Description of the vulnerability
- Steps to reproduce
- Affected components and versions
- Suggested fix (if any)

We will acknowledge receipt within 48 hours and provide a fix timeline within 7 days.

## Security Requirements

- Never commit `.env`, `*.pem`, `*.key`, or `*.crt` files
- All secrets must come from environment variables only
- No hardcoded API keys, tokens, or credentials in source
- All log output is structured NDJSON; never log PII or secrets
- Code reviews required via `CODEOWNERS` before merge to `main`

## Authority Roles

- `maintainers` — can merge to `main`, approve releases, rotate secrets
- `contributors` — can open PRs, cannot push directly to `main`
- `reviewers` — required approval on all `main`-targeting PRs
