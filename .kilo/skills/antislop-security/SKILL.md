---
name: antislop-security
description: "App security audit and secure coding skill for antislop. Use when building, reviewing, or auditing code for OWASP Top 10, injection, XSS, auth/authz, secrets, or dependency risk. Load with the core."
allowed-tools: Read Write Edit Glob Grep Bash
---

# antislop-security

**Application security audit and secure coding practices for AI coding agents.**

This skill deep-dives into application security concerns. It loads when the task involves building, reviewing, or auditing code for security vulnerabilities. It references the core `antislop` rules by number and never duplicates them.

## 🎯 Core Philosophy

This is a **filter, not a scanner**. It does not replace SAST/DAST tools. Its job is to stop the agent from *generating* insecure code patterns and to *audit* existing code against the most common application security failures.

## 🧠 Scope & Expertise

*   **OWASP Top 10 (2021 & 2025):** Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable Components, Auth Failures, Data Integrity Failures, Logging Failures, SSRF.
*   **Threat Modeling:** STRIDE methodology, attack trees, trust boundaries.
*   **Secure Coding:** Input validation, output encoding, parameterized queries, secrets management, authentication/authorization patterns (OAuth2, JWT).
*   **Dependency Security:** Detecting vulnerable and outdated components.

## 📜 Mandatory Security Rules (S-01 to S-10)

These are **Hard Gates**. Violating any of these is a critical failure.

| ID | Rule | What to check |
| :--- | :--- | :--- |
| **S-01** | **No Hardcoded Secrets** | API keys, passwords, tokens, private keys must never appear in source code, config files, or logs. Use environment variables or a secrets manager. |
| **S-02** | **Input Validation at Boundary** | Every API endpoint, form handler, and file upload must validate and sanitize input. Never trust user input. |
| **S-03** | **Parameterized Queries Only** | Never build SQL, NoSQL, or ORM queries with string concatenation or interpolation. |
| **S-04** | **Output Encoding** | All user-supplied data rendered in HTML, JS, or CSS must be contextually encoded to prevent XSS. |
| **S-05** | **Authentication & Authorization** | Every endpoint must enforce authentication and authorization. Implement least privilege. |
| **S-06** | **Secure Cryptography** | Use modern, vetted libraries (e.g., Argon2, bcrypt). Never implement custom crypto. |
| **S-07** | **No Sensitive Data in Logs** | PII, credentials, tokens, and session IDs must be redacted or omitted from logs. |
| **S-08** | **Dependency Hygiene** | Do not introduce libraries with known critical vulnerabilities. Check for outdated packages. |
| **S-09** | **Secure Defaults** | Security features (e.g., CORS, CSP, HttpOnly cookies) must be enabled by default, not opt-in. |
| **S-10** | **Fail Securely** | Error messages must not leak stack traces, database schemas, or internal paths to the user. |

## 🛠️ Usage Modes

### During (Building New Code)
1.  Load this skill at the start of a session focused on a security-sensitive feature.
2.  The agent will apply the mandatory rules (S-01 to S-10) during implementation.
3.  Before finishing, run the **Security Delivery Gate** (see below).

### After (Auditing Existing Code)
1.  Load this skill to audit a file, module, or pull request.
2.  The agent produces a numbered findings list, each citing the rule (S-XX) and providing a concrete fix.
3.  You approve which findings to fix.

## 🚦 Security Delivery Gate

Before any code is shipped, the agent must produce a **PASS/FAIL** report:
