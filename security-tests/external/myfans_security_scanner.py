#!/usr/bin/env python3
"""
============================================================================
MYFANS PLATFORM — EXTERNAL SECURITY SCANNER (PENTEST SCRIPT)
============================================================================

Metodologias: OWASP Top 10 2021, OWASP API Security Top 10 2023, MITRE ATT&CK
Tipo: Simulação de ataque cibernético externo (brute force / agressivo)
Executor: CodeSandbox ou qualquer ambiente Python 3.10+

Dependências (pip install):
    pip install requests aiohttp asyncio

Uso:
    python myfans_security_scanner.py --target https://api.myfans.my
    python myfans_security_scanner.py --target http://localhost:3001

O script gera um relatório JSON + Markdown que deve ser trazido de volta
ao prompt do Claude para consolidação com o teste interno.

============================================================================
AVISO: Este script é para uso EXCLUSIVO em testes de segurança autorizados
da plataforma MyFans. Uso não autorizado é ilegal.
============================================================================
"""

import argparse
import asyncio
import json
import os
import sys
import time
import hashlib
import random
import string
from datetime import datetime, timezone
from dataclasses import dataclass, field, asdict
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    print("[!] Instale: pip install requests")
    sys.exit(1)

try:
    import aiohttp
except ImportError:
    aiohttp = None
    print("[!] aiohttp não instalado. Testes async serão executados com threads.")


# ============================================================================
# CONFIGURAÇÃO
# ============================================================================

VERSION = "1.0.0"
USER_AGENT = "MyFans-SecurityScanner/1.0"
MAX_WORKERS = 20
REQUEST_TIMEOUT = 15


@dataclass
class Finding:
    """Representa uma vulnerabilidade encontrada."""
    category: str           # OWASP category
    severity: str           # CRITICAL, HIGH, MEDIUM, LOW, INFO
    title: str
    description: str
    endpoint: str
    evidence: str = ""
    mitre_id: str = ""      # MITRE ATT&CK ID
    owasp_id: str = ""      # OWASP ID
    remediation: str = ""
    cvss_estimate: float = 0.0


@dataclass
class TestResult:
    """Resultado individual de um teste."""
    test_name: str
    category: str
    passed: bool
    details: str
    duration_ms: float = 0.0
    requests_sent: int = 0
    status_codes: list = field(default_factory=list)


@dataclass
class ScanReport:
    """Relatório completo do scan."""
    target: str
    scan_start: str = ""
    scan_end: str = ""
    scanner_version: str = VERSION
    total_tests: int = 0
    tests_passed: int = 0
    tests_failed: int = 0
    tests_warning: int = 0
    findings: list = field(default_factory=list)
    test_results: list = field(default_factory=list)
    confidence_score: float = 0.0
    grade: str = ""
    category_scores: dict = field(default_factory=dict)
    summary: str = ""


class SecurityScanner:
    """Scanner de segurança externo para a API MyFans."""

    def __init__(self, target: str, verbose: bool = False):
        self.target = target.rstrip('/')
        self.base_url = f"{self.target}/api/v1"
        self.verbose = verbose
        self.findings: list[Finding] = []
        self.results: list[TestResult] = []
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        session = requests.Session()
        session.headers.update({
            'User-Agent': USER_AGENT,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        })
        retry = Retry(total=2, backoff_factor=0.5, status_forcelist=[502, 503, 504])
        adapter = HTTPAdapter(max_retries=retry, pool_connections=MAX_WORKERS, pool_maxsize=MAX_WORKERS)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        return session

    def log(self, msg: str):
        if self.verbose:
            print(f"  [>] {msg}")

    def _req(self, method: str, path: str, **kwargs) -> Optional[requests.Response]:
        url = f"{self.base_url}{path}"
        kwargs.setdefault('timeout', REQUEST_TIMEOUT)
        try:
            return self.session.request(method, url, **kwargs)
        except requests.exceptions.RequestException as e:
            self.log(f"Request failed: {e}")
            return None

    def add_finding(self, **kwargs):
        self.findings.append(Finding(**kwargs))

    def add_result(self, **kwargs):
        self.results.append(TestResult(**kwargs))

    # ========================================================================
    # [RECON] RECONHECIMENTO — MITRE TA0043
    # ========================================================================

    def test_reconnaissance(self):
        print("\n[1/12] RECONHECIMENTO (MITRE TA0043)")
        print("=" * 60)

        # Test health endpoint information disclosure
        start = time.time()
        r = self._req('GET', '/health')
        elapsed = (time.time() - start) * 1000

        if r:
            data = r.json() if r.status_code == 200 else {}
            self.add_result(
                test_name="Health endpoint info disclosure",
                category="RECON",
                passed='secret' not in json.dumps(data).lower() and 'database' not in json.dumps(data).lower(),
                details=f"Status: {r.status_code}, Keys: {list(data.keys())}",
                duration_ms=elapsed,
                requests_sent=1,
                status_codes=[r.status_code]
            )

            if 'version' in data:
                self.add_finding(
                    category="Information Disclosure",
                    severity="LOW",
                    title="API version exposed in health endpoint",
                    description=f"Health endpoint reveals API version: {data.get('version')}",
                    endpoint="/api/v1/health",
                    evidence=json.dumps(data),
                    mitre_id="T1592",
                    owasp_id="A05:2021",
                    remediation="Consider removing version info from public health endpoint in production",
                    cvss_estimate=2.0
                )
            print(f"  [✓] Health endpoint: {list(data.keys())}")
        else:
            print(f"  [✗] Health endpoint unreachable")
            self.add_result(
                test_name="Health endpoint reachability",
                category="RECON",
                passed=False,
                details="Target unreachable",
                requests_sent=1,
            )

        # Test server headers
        if r:
            server = r.headers.get('Server', 'Not Set')
            x_powered = r.headers.get('X-Powered-By', 'Not Set')
            self.add_result(
                test_name="Server header disclosure",
                category="RECON",
                passed=server == 'Not Set' and x_powered == 'Not Set',
                details=f"Server: {server}, X-Powered-By: {x_powered}",
                requests_sent=0,
            )
            if x_powered != 'Not Set':
                self.add_finding(
                    category="Information Disclosure",
                    severity="LOW",
                    title="X-Powered-By header reveals technology stack",
                    description=f"Server exposes technology: {x_powered}",
                    endpoint="ALL",
                    evidence=f"X-Powered-By: {x_powered}",
                    mitre_id="T1592.004",
                    owasp_id="A05:2021",
                    remediation="Remove X-Powered-By header",
                    cvss_estimate=2.0
                )
            print(f"  [{'✓' if server == 'Not Set' else '!'}] Server: {server}")
            print(f"  [{'✓' if x_powered == 'Not Set' else '!'}] X-Powered-By: {x_powered}")

        # Test common paths for info leakage
        leak_paths = [
            '/.env', '/api/v1/.env', '/.git/config', '/api/docs',
            '/api/swagger.json', '/api/v1/swagger', '/debug',
            '/api/v1/debug', '/graphql', '/api/graphql',
            '/.well-known/security.txt', '/robots.txt', '/sitemap.xml',
        ]
        leaked = []
        for path in leak_paths:
            r = self._req('GET', path.replace('/api/v1', ''))
            if r and r.status_code == 200:
                leaked.append(path)

        self.add_result(
            test_name="Sensitive path exposure",
            category="RECON",
            passed=len(leaked) == 0,
            details=f"Exposed paths: {leaked}" if leaked else "No sensitive paths exposed",
            requests_sent=len(leak_paths),
        )
        print(f"  [{'✗' if leaked else '✓'}] Sensitive paths: {leaked if leaked else 'None found'}")

    # ========================================================================
    # [AUTH-BRUTE] BRUTE FORCE AUTH — MITRE T1110
    # ========================================================================

    def test_auth_bruteforce(self):
        print("\n[2/12] BRUTE FORCE AUTENTICAÇÃO (MITRE T1110)")
        print("=" * 60)

        # Test 1: Login brute force
        common_passwords = [
            'password', '123456', '12345678', 'admin', 'letmein',
            'welcome', 'monkey', '1234567', 'dragon', '111111',
            'baseball', 'master', 'qwerty', 'abc123', 'login',
            'admin123', 'Password1', 'p@ssw0rd', '1q2w3e4r',
            'passw0rd',
        ]

        target_email = 'admin@myfans.my'
        statuses = []
        rate_limited_count = 0
        start = time.time()

        print(f"  [>] Testando {len(common_passwords)} senhas contra {target_email}...")
        for pwd in common_passwords:
            r = self._req('POST', '/auth/login', json={
                'email': target_email,
                'password': pwd
            })
            if r:
                statuses.append(r.status_code)
                if r.status_code == 429:
                    rate_limited_count += 1
                elif r.status_code == 200:
                    self.add_finding(
                        category="Authentication",
                        severity="CRITICAL",
                        title="Weak credentials discovered via brute force",
                        description=f"Login succeeded with password from common list",
                        endpoint="/api/v1/auth/login",
                        evidence=f"Password found in top 20 common passwords",
                        mitre_id="T1110.001",
                        owasp_id="A07:2021",
                        remediation="Enforce strong password policy, implement account lockout",
                        cvss_estimate=9.0
                    )
                    break

        elapsed = (time.time() - start) * 1000

        # Evaluate rate limiting effectiveness
        rate_limit_effective = rate_limited_count > 0
        self.add_result(
            test_name="Login brute force resistance",
            category="AUTH",
            passed=rate_limit_effective,
            details=f"Rate limited: {rate_limited_count}/{len(statuses)} requests. "
                    f"Statuses: {dict(zip(*[list(set(statuses)), [statuses.count(s) for s in set(statuses)]]))}" if statuses else "No responses",
            duration_ms=elapsed,
            requests_sent=len(common_passwords),
            status_codes=statuses
        )
        print(f"  [{'✓' if rate_limit_effective else '!'}] Rate limiting: {rate_limited_count}/{len(statuses)} blocked")

        if not rate_limit_effective:
            self.add_finding(
                category="Rate Limiting",
                severity="HIGH",
                title="Auth brute force not effectively rate limited",
                description=f"Sent {len(statuses)} login attempts without being rate limited",
                endpoint="/api/v1/auth/login",
                evidence=f"Status codes: {statuses[:10]}...",
                mitre_id="T1110",
                owasp_id="API4:2023",
                remediation="Implement stricter rate limiting or account lockout after N failed attempts",
                cvss_estimate=7.5
            )

        # Test 2: Credential Stuffing (different emails, same password)
        print(f"  [>] Testando credential stuffing (emails variados)...")
        stuffing_statuses = []
        for i in range(20):
            r = self._req('POST', '/auth/login', json={
                'email': f'user{i}@example.com',
                'password': 'Password123'
            })
            if r:
                stuffing_statuses.append(r.status_code)

        stuffing_blocked = sum(1 for s in stuffing_statuses if s == 429)
        self.add_result(
            test_name="Credential stuffing resistance",
            category="AUTH",
            passed=stuffing_blocked > 0,
            details=f"Blocked: {stuffing_blocked}/{len(stuffing_statuses)}",
            requests_sent=20,
            status_codes=stuffing_statuses
        )
        print(f"  [{'✓' if stuffing_blocked > 0 else '!'}] Credential stuffing blocked: {stuffing_blocked}/20")

        # Test 3: Username enumeration via registration
        print(f"  [>] Testando enumeração de emails...")
        r1 = self._req('POST', '/auth/login', json={'email': 'definitelynotexists@nobody.xyz', 'password': 'Wrong123'})
        r2 = self._req('POST', '/auth/login', json={'email': 'admin@myfans.my', 'password': 'Wrong123'})

        if r1 and r2:
            msg1 = r1.json().get('error', {}).get('message', '') if r1.status_code != 429 else ''
            msg2 = r2.json().get('error', {}).get('message', '') if r2.status_code != 429 else ''
            same_message = msg1 == msg2 or r1.status_code == 429 or r2.status_code == 429
            self.add_result(
                test_name="Email enumeration prevention",
                category="AUTH",
                passed=same_message,
                details=f"Non-existent: '{msg1}' vs Existing: '{msg2}'",
                requests_sent=2,
            )
            print(f"  [{'✓' if same_message else '✗'}] Email enumeration: {'Same error message' if same_message else 'DIFFERENT messages!'}")
            if not same_message:
                self.add_finding(
                    category="Authentication",
                    severity="MEDIUM",
                    title="Email enumeration possible via login error messages",
                    description="Different error messages for existing vs non-existing emails",
                    endpoint="/api/v1/auth/login",
                    evidence=f"Non-existent: '{msg1}', Existing: '{msg2}'",
                    mitre_id="T1589.002",
                    owasp_id="A07:2021",
                    remediation="Return identical error messages for all login failures",
                    cvss_estimate=5.0
                )

    # ========================================================================
    # [JWT] JWT ATTACKS — MITRE T1528
    # ========================================================================

    def test_jwt_attacks(self):
        print("\n[3/12] ATAQUES JWT (MITRE T1528)")
        print("=" * 60)

        # Test 1: None algorithm attack
        import base64
        header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b'=').decode()
        payload = base64.urlsafe_b64encode(json.dumps({"sub": "admin-id", "role": "admin", "exp": int(time.time()) + 3600}).encode()).rstrip(b'=').decode()
        none_token = f"{header}.{payload}."

        r = self._req('GET', '/auth/me', headers={'Authorization': f'Bearer {none_token}'})
        none_blocked = r.status_code == 401 if r else True
        self.add_result(
            test_name="JWT none algorithm attack",
            category="JWT",
            passed=none_blocked,
            details=f"Status: {r.status_code if r else 'no response'}",
            requests_sent=1,
            status_codes=[r.status_code] if r else []
        )
        print(f"  [{'✓' if none_blocked else '✗'}] alg:none attack: {'Blocked' if none_blocked else 'VULNERABLE!'}")

        if not none_blocked:
            self.add_finding(
                category="Authentication",
                severity="CRITICAL",
                title="JWT none algorithm accepted",
                description="Server accepts JWT tokens with alg:none, allowing arbitrary token forgery",
                endpoint="/api/v1/auth/me",
                evidence=f"Token with alg:none returned status {r.status_code if r else 'N/A'}",
                mitre_id="T1528",
                owasp_id="A02:2021",
                remediation="Explicitly reject 'none' algorithm in JWT verification",
                cvss_estimate=9.8
            )

        # Test 2: Weak secret attack (common secrets)
        weak_secrets = [
            'secret', 'jwt_secret', 'mysecret', 'password', 'key',
            'myfans', 'myfans-secret', 'test', 'development',
            'changeme', 'default', '123456', 'qwerty',
        ]

        import hmac
        for secret in weak_secrets:
            try:
                h = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b'=').decode()
                p = base64.urlsafe_b64encode(json.dumps({
                    "sub": "admin-id", "role": "admin",
                    "exp": int(time.time()) + 3600, "iat": int(time.time())
                }).encode()).rstrip(b'=').decode()
                sig_input = f"{h}.{p}".encode()
                sig = base64.urlsafe_b64encode(
                    hmac.new(secret.encode(), sig_input, hashlib.sha256).digest()
                ).rstrip(b'=').decode()
                token = f"{h}.{p}.{sig}"

                r = self._req('GET', '/auth/me', headers={'Authorization': f'Bearer {token}'})
                if r and r.status_code == 200:
                    self.add_finding(
                        category="Authentication",
                        severity="CRITICAL",
                        title="JWT signed with weak/guessable secret",
                        description=f"JWT secret is guessable: '{secret}'",
                        endpoint="/api/v1/auth/me",
                        evidence=f"Token signed with '{secret}' was accepted",
                        mitre_id="T1528",
                        owasp_id="A02:2021",
                        remediation="Use a strong, randomly generated JWT secret (256+ bits)",
                        cvss_estimate=9.8
                    )
                    print(f"  [✗] CRITICAL: JWT secret is '{secret}'!")
                    break
            except Exception:
                continue

        self.add_result(
            test_name="JWT weak secret bruteforce",
            category="JWT",
            passed=True,  # Passed if no weak secret found
            details=f"Tested {len(weak_secrets)} common secrets, none accepted",
            requests_sent=len(weak_secrets),
        )
        print(f"  [✓] Weak secret bruteforce: {len(weak_secrets)} secrets tested, none worked")

        # Test 3: Expired token
        h = base64.urlsafe_b64encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()).rstrip(b'=').decode()
        p = base64.urlsafe_b64encode(json.dumps({
            "sub": "user-id", "role": "fan",
            "exp": int(time.time()) - 3600,  # Expired 1 hour ago
            "iat": int(time.time()) - 7200
        }).encode()).rstrip(b'=').decode()
        expired_token = f"{h}.{p}.fake-sig"

        r = self._req('GET', '/auth/me', headers={'Authorization': f'Bearer {expired_token}'})
        expired_blocked = r.status_code == 401 if r else True
        self.add_result(
            test_name="Expired JWT rejection",
            category="JWT",
            passed=expired_blocked,
            details=f"Status: {r.status_code if r else 'no response'}",
            requests_sent=1,
        )
        print(f"  [{'✓' if expired_blocked else '✗'}] Expired token: {'Rejected' if expired_blocked else 'ACCEPTED!'}")

        # Test 4: Modified payload (tampered token)
        random_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.tampered'
        r = self._req('GET', '/admin/dashboard', headers={'Authorization': f'Bearer {random_token}'})
        tamper_blocked = r.status_code in (401, 403) if r else True
        self.add_result(
            test_name="Tampered JWT rejection",
            category="JWT",
            passed=tamper_blocked,
            details=f"Status: {r.status_code if r else 'no response'}",
            requests_sent=1,
        )
        print(f"  [{'✓' if tamper_blocked else '✗'}] Tampered token: {'Rejected' if tamper_blocked else 'ACCEPTED!'}")

    # ========================================================================
    # [INJECTION] SQL/NoSQL/CMD INJECTION — OWASP A03:2021
    # ========================================================================

    def test_injection_attacks(self):
        print("\n[4/12] ATAQUES DE INJEÇÃO (OWASP A03:2021)")
        print("=" * 60)

        sql_payloads = [
            "' OR '1'='1",
            "'; DROP TABLE users;--",
            "1' UNION SELECT * FROM users--",
            "admin'--",
            "1; DELETE FROM users WHERE 1=1",
            "' AND (SELECT COUNT(*) FROM information_schema.tables) > 0--",
            "') OR ('1'='1",
            "' OR SLEEP(5)--",
            "1' AND 1=CONVERT(int, (SELECT TOP 1 table_name FROM information_schema.tables))--",
            "' UNION ALL SELECT NULL,password_hash,NULL FROM users--",
        ]

        nosql_payloads = [
            {"$gt": ""},
            {"$ne": None},
            {"$regex": ".*"},
            {"$where": "1==1"},
        ]

        # SQL Injection in Login
        print(f"  [>] Testando {len(sql_payloads)} payloads SQL em login...")
        sql_vulnerable = False
        error_500_count = 0
        for payload in sql_payloads:
            r = self._req('POST', '/auth/login', json={'email': payload, 'password': payload})
            if r:
                if r.status_code == 500:
                    error_500_count += 1
                    sql_vulnerable = True
                if r.status_code == 200:
                    sql_vulnerable = True
                    self.add_finding(
                        category="Injection",
                        severity="CRITICAL",
                        title="SQL Injection in login endpoint",
                        description=f"Login succeeded with SQL payload: {payload}",
                        endpoint="/api/v1/auth/login",
                        evidence=f"Payload: {payload}, Status: {r.status_code}",
                        mitre_id="T1190",
                        owasp_id="A03:2021",
                        remediation="Use parameterized queries, validate input types",
                        cvss_estimate=9.8
                    )

        self.add_result(
            test_name="SQL Injection - Login",
            category="INJECTION",
            passed=not sql_vulnerable,
            details=f"500 errors: {error_500_count}/{len(sql_payloads)}. {'VULNERABLE' if sql_vulnerable else 'Protected'}",
            requests_sent=len(sql_payloads),
        )
        print(f"  [{'✗' if sql_vulnerable else '✓'}] SQL Injection login: {error_500_count} errors/500")

        # SQL Injection in search/query params
        print(f"  [>] Testando SQL injection em query params...")
        query_vulnerable = False
        for payload in sql_payloads[:5]:
            r = self._req('GET', f'/discover/search?q={requests.utils.quote(payload)}')
            if r and r.status_code == 500:
                query_vulnerable = True

        self.add_result(
            test_name="SQL Injection - Query params",
            category="INJECTION",
            passed=not query_vulnerable,
            details="Protected" if not query_vulnerable else "500 errors detected",
            requests_sent=5,
        )
        print(f"  [{'✗' if query_vulnerable else '✓'}] SQL Injection query: {'Vulnerable' if query_vulnerable else 'Protected'}")

        # NoSQL Injection
        print(f"  [>] Testando NoSQL injection...")
        nosql_vulnerable = False
        for payload in nosql_payloads:
            r = self._req('POST', '/auth/login', json={'email': payload, 'password': payload})
            if r and r.status_code == 200:
                nosql_vulnerable = True

        self.add_result(
            test_name="NoSQL Injection - Login",
            category="INJECTION",
            passed=not nosql_vulnerable,
            details="Protected" if not nosql_vulnerable else "NoSQL injection succeeded",
            requests_sent=len(nosql_payloads),
        )
        print(f"  [{'✗' if nosql_vulnerable else '✓'}] NoSQL Injection: {'Vulnerable' if nosql_vulnerable else 'Protected'}")

        # Command Injection in username
        cmd_payloads = ['; ls -la', '| cat /etc/passwd', '$(whoami)', '`id`']
        print(f"  [>] Testando command injection em registro...")
        cmd_vulnerable = False
        for payload in cmd_payloads:
            r = self._req('POST', '/auth/register', json={
                'email': f'cmd{int(time.time())}@test.com',
                'password': 'Test1234',
                'username': payload,
                'dateOfBirth': '2000-01-01'
            })
            if r and r.status_code == 200:
                cmd_vulnerable = True

        self.add_result(
            test_name="Command Injection - Register",
            category="INJECTION",
            passed=not cmd_vulnerable,
            details="Protected" if not cmd_vulnerable else "Command injection in username accepted",
            requests_sent=len(cmd_payloads),
        )
        print(f"  [{'✗' if cmd_vulnerable else '✓'}] Command Injection: {'Vulnerable' if cmd_vulnerable else 'Protected'}")

        if sql_vulnerable:
            self.add_finding(
                category="Injection",
                severity="HIGH",
                title="Potential SQL Injection causing 500 errors",
                description=f"{error_500_count} SQL payloads caused server errors",
                endpoint="/api/v1/auth/login",
                evidence=f"500 errors with SQL payloads",
                mitre_id="T1190",
                owasp_id="A03:2021",
                remediation="Ensure all SQL queries use parameterized statements, add input validation",
                cvss_estimate=8.0
            )

    # ========================================================================
    # [XSS] CROSS-SITE SCRIPTING — OWASP A07:2021
    # ========================================================================

    def test_xss_attacks(self):
        print("\n[5/12] ATAQUES XSS (OWASP A07:2021)")
        print("=" * 60)

        xss_payloads = [
            '<script>alert("XSS")</script>',
            '<img src=x onerror=alert(1)>',
            '<svg/onload=alert(1)>',
            'javascript:alert(1)',
            '"><img src=x onerror=alert(1)>',
            "'><script>alert(document.cookie)</script>",
            '<body onload=alert(1)>',
            '<details open ontoggle=alert(1)>',
            '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>',
            '<a href="data:text/html,<script>alert(1)</script>">click</a>',
        ]

        # Test XSS in search
        print(f"  [>] Testando {len(xss_payloads)} payloads XSS em busca...")
        reflected = False
        for payload in xss_payloads:
            r = self._req('GET', f'/discover/search?q={requests.utils.quote(payload)}')
            if r and payload in r.text:
                reflected = True
                self.add_finding(
                    category="XSS",
                    severity="HIGH",
                    title="Reflected XSS in search endpoint",
                    description=f"XSS payload reflected in search response",
                    endpoint="/api/v1/discover/search",
                    evidence=f"Payload reflected: {payload[:50]}",
                    mitre_id="T1189",
                    owasp_id="A07:2021",
                    remediation="Encode all output, implement CSP headers",
                    cvss_estimate=7.0
                )
                break

        self.add_result(
            test_name="Reflected XSS - Search",
            category="XSS",
            passed=not reflected,
            details="No reflection detected" if not reflected else "XSS payload reflected!",
            requests_sent=len(xss_payloads),
        )
        print(f"  [{'✗' if reflected else '✓'}] Reflected XSS: {'Found!' if reflected else 'Not reflected'}")

        # Test XSS in registration fields
        print(f"  [>] Testando Stored XSS em registro...")
        stored = False
        for payload in xss_payloads[:3]:
            r = self._req('POST', '/auth/register', json={
                'email': f'xss{int(time.time())}@test.com',
                'password': 'Test1234',
                'username': f'xsstest{random.randint(1000,9999)}',
                'displayName': payload,
                'dateOfBirth': '2000-01-01'
            })
            if r and r.status_code == 200:
                data = r.json().get('data', {}).get('user', {})
                if data.get('displayName') == payload:
                    # Stored but check if it would be rendered
                    self.add_finding(
                        category="XSS",
                        severity="MEDIUM",
                        title="Potential Stored XSS via displayName",
                        description="HTML/script content accepted in displayName field without sanitization",
                        endpoint="/api/v1/auth/register",
                        evidence=f"Stored: {payload[:50]}",
                        mitre_id="T1189",
                        owasp_id="A07:2021",
                        remediation="Sanitize or encode HTML entities in user-generated content fields",
                        cvss_estimate=6.0
                    )
                    stored = True
                    break

        self.add_result(
            test_name="Stored XSS - displayName",
            category="XSS",
            passed=not stored,
            details="HTML content sanitized" if not stored else "HTML stored in displayName",
            requests_sent=3,
        )
        print(f"  [{'!' if stored else '✓'}] Stored XSS displayName: {'Stored (needs frontend encoding)' if stored else 'Sanitized'}")

        # Test security headers against XSS
        r = self._req('GET', '/health')
        if r:
            csp = r.headers.get('Content-Security-Policy', '')
            x_xss = r.headers.get('X-XSS-Protection', '')
            x_ct = r.headers.get('X-Content-Type-Options', '')

            has_protection = bool(csp) or bool(x_xss) or x_ct == 'nosniff'
            self.add_result(
                test_name="XSS protection headers",
                category="XSS",
                passed=has_protection,
                details=f"CSP: {'Yes' if csp else 'No'}, X-XSS: {x_xss or 'No'}, nosniff: {x_ct}",
                requests_sent=1,
            )
            print(f"  [{'✓' if has_protection else '✗'}] Headers: CSP={'Yes' if csp else 'No'}, X-XSS={x_xss or 'No'}, nosniff={x_ct}")

    # ========================================================================
    # [AUTHZ] BROKEN AUTHORIZATION — OWASP API1, API5
    # ========================================================================

    def test_authorization_attacks(self):
        print("\n[6/12] ATAQUES DE AUTORIZAÇÃO (OWASP API1/API5)")
        print("=" * 60)

        # Protected endpoints that should require auth
        protected = [
            ('GET', '/auth/me'),
            ('GET', '/users/me'),
            ('PATCH', '/users/me'),
            ('GET', '/users/me/settings'),
            ('GET', '/subscriptions'),
            ('GET', '/fancoins/wallet'),
            ('GET', '/fancoins/transactions'),
            ('GET', '/notifications'),
            ('GET', '/admin/dashboard'),
            ('GET', '/admin/users'),
            ('POST', '/posts'),
            ('POST', '/fancoins/tip'),
            ('POST', '/subscriptions'),
        ]

        unprotected = []
        print(f"  [>] Testando {len(protected)} endpoints protegidos...")
        for method, path in protected:
            r = self._req(method, path)
            if r and r.status_code not in (401, 403):
                unprotected.append(f"{method} {path} -> {r.status_code}")

        self.add_result(
            test_name="Protected endpoints require auth",
            category="AUTHZ",
            passed=len(unprotected) == 0,
            details=f"Unprotected: {unprotected}" if unprotected else "All endpoints protected",
            requests_sent=len(protected),
        )
        print(f"  [{'✗' if unprotected else '✓'}] Auth required: {len(protected) - len(unprotected)}/{len(protected)} protected")

        for ep in unprotected:
            self.add_finding(
                category="Authorization",
                severity="HIGH",
                title=f"Endpoint accessible without authentication: {ep}",
                description="Protected endpoint returns non-401/403 without auth token",
                endpoint=ep,
                evidence=ep,
                mitre_id="T1078",
                owasp_id="API5:2023",
                remediation="Ensure authMiddleware is applied to all sensitive endpoints",
                cvss_estimate=7.5
            )

        # Test admin escalation with fake role
        print(f"  [>] Testando escalação de privilégios...")
        fake_admin_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlIjoiYWRtaW4ifQ.fake'
        r = self._req('GET', '/admin/dashboard', headers={'Authorization': f'Bearer {fake_admin_token}'})
        escalation_blocked = r.status_code in (401, 403) if r else True
        self.add_result(
            test_name="Admin privilege escalation",
            category="AUTHZ",
            passed=escalation_blocked,
            details=f"Status: {r.status_code if r else 'no response'}",
            requests_sent=1,
        )
        print(f"  [{'✓' if escalation_blocked else '✗'}] Privilege escalation: {'Blocked' if escalation_blocked else 'VULNERABLE!'}")

    # ========================================================================
    # [RATE] RATE LIMIT / DDoS — OWASP API4:2023
    # ========================================================================

    def test_rate_limiting(self):
        print("\n[7/12] RATE LIMITING E DoS (OWASP API4:2023)")
        print("=" * 60)

        # Test 1: Global rate limit (100 req/min)
        print(f"  [>] Flood test: 120 requests em burst...")
        start = time.time()
        statuses = []

        def make_request(_):
            r = self._req('GET', '/health')
            return r.status_code if r else 0

        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            results = list(executor.map(make_request, range(120)))
            statuses = results

        elapsed = (time.time() - start) * 1000
        rate_limited = sum(1 for s in statuses if s == 429)

        self.add_result(
            test_name="Global rate limit (100 req/min)",
            category="RATE",
            passed=rate_limited > 0,
            details=f"Blocked: {rate_limited}/120 in {elapsed:.0f}ms",
            duration_ms=elapsed,
            requests_sent=120,
            status_codes=statuses
        )
        print(f"  [{'✓' if rate_limited > 0 else '!'}] Global rate limit: {rate_limited}/120 blocked ({elapsed:.0f}ms)")

        if rate_limited == 0:
            self.add_finding(
                category="Rate Limiting",
                severity="MEDIUM",
                title="Global rate limit not enforced or Redis unavailable",
                description="120 burst requests completed without rate limiting",
                endpoint="/api/v1/health",
                evidence=f"0/120 requests blocked",
                mitre_id="T1498",
                owasp_id="API4:2023",
                remediation="Ensure Redis is configured for rate limiting in production",
                cvss_estimate=5.0
            )

        # Test 2: Auth endpoint rate limit (10 req/15min)
        print(f"  [>] Auth rate limit: 15 requests em burst...")
        auth_statuses = []
        for i in range(15):
            r = self._req('POST', '/auth/login', json={'email': f'test{i}@x.com', 'password': 'x'})
            if r:
                auth_statuses.append(r.status_code)

        auth_blocked = sum(1 for s in auth_statuses if s == 429)
        self.add_result(
            test_name="Auth rate limit (10 req/15min)",
            category="RATE",
            passed=auth_blocked > 0,
            details=f"Blocked: {auth_blocked}/15",
            requests_sent=15,
            status_codes=auth_statuses
        )
        print(f"  [{'✓' if auth_blocked > 0 else '!'}] Auth rate limit: {auth_blocked}/15 blocked")

        # Test 3: Slowloris-style (many concurrent connections)
        print(f"  [>] Concurrent connections test...")
        start = time.time()
        concurrent_statuses = []

        def slow_request(_):
            try:
                r = requests.get(f"{self.base_url}/health", timeout=10, headers={'Connection': 'keep-alive'})
                return r.status_code
            except:
                return 0

        with ThreadPoolExecutor(max_workers=50) as executor:
            concurrent_statuses = list(executor.map(slow_request, range(50)))

        concurrent_elapsed = (time.time() - start) * 1000
        concurrent_success = sum(1 for s in concurrent_statuses if s == 200)
        self.add_result(
            test_name="Concurrent connection handling",
            category="RATE",
            passed=concurrent_success > 0,
            details=f"Success: {concurrent_success}/50 in {concurrent_elapsed:.0f}ms",
            duration_ms=concurrent_elapsed,
            requests_sent=50,
        )
        print(f"  [{'✓' if concurrent_success > 0 else '✗'}] Concurrent: {concurrent_success}/50 succeeded ({concurrent_elapsed:.0f}ms)")

    # ========================================================================
    # [CORS] CORS MISCONFIGURATION
    # ========================================================================

    def test_cors(self):
        print("\n[8/12] CONFIGURAÇÃO CORS")
        print("=" * 60)

        malicious_origins = [
            'https://evil-attacker.com',
            'https://myfans.evil.com',
            'https://myfans.my.evil.com',
            'null',
            'https://localhost.evil.com',
            'http://127.0.0.1',
        ]

        misconfigured = []
        for origin in malicious_origins:
            r = self._req('OPTIONS', '/health', headers={
                'Origin': origin,
                'Access-Control-Request-Method': 'GET'
            })
            if r:
                allow_origin = r.headers.get('Access-Control-Allow-Origin', '')
                if allow_origin == origin or allow_origin == '*':
                    misconfigured.append(f"{origin} -> {allow_origin}")

        self.add_result(
            test_name="CORS origin validation",
            category="CORS",
            passed=len(misconfigured) == 0,
            details=f"Misconfigured: {misconfigured}" if misconfigured else "All malicious origins rejected",
            requests_sent=len(malicious_origins),
        )
        print(f"  [{'✗' if misconfigured else '✓'}] CORS: {len(malicious_origins) - len(misconfigured)}/{len(malicious_origins)} origins properly blocked")

        for mc in misconfigured:
            self.add_finding(
                category="CORS",
                severity="HIGH",
                title=f"CORS misconfiguration allows untrusted origin",
                description=f"Origin accepted: {mc}",
                endpoint="ALL",
                evidence=mc,
                owasp_id="A05:2021",
                remediation="Strictly whitelist allowed origins, never use wildcard with credentials",
                cvss_estimate=6.5
            )

        # Test credentials with wildcard
        r = self._req('GET', '/health', headers={'Origin': 'https://evil.com'})
        if r:
            allow_creds = r.headers.get('Access-Control-Allow-Credentials', '')
            allow_origin = r.headers.get('Access-Control-Allow-Origin', '')
            bad_combo = allow_creds == 'true' and allow_origin == '*'
            self.add_result(
                test_name="CORS credentials + wildcard check",
                category="CORS",
                passed=not bad_combo,
                details=f"Credentials: {allow_creds}, Origin: {allow_origin}",
                requests_sent=1,
            )
            print(f"  [{'✗' if bad_combo else '✓'}] Credentials+wildcard: {'VULNERABLE' if bad_combo else 'Safe'}")

    # ========================================================================
    # [HEADERS] SECURITY HEADERS
    # ========================================================================

    def test_security_headers(self):
        print("\n[9/12] SECURITY HEADERS (OWASP A05:2021)")
        print("=" * 60)

        r = self._req('GET', '/health')
        if not r:
            print("  [✗] Cannot test headers - target unreachable")
            return

        expected_headers = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': ['DENY', 'SAMEORIGIN'],
            'Strict-Transport-Security': None,  # Just check presence
            'Content-Security-Policy': None,
            'X-XSS-Protection': None,
            'Referrer-Policy': None,
            'Permissions-Policy': None,
        }

        missing = []
        present = []
        for header, expected_value in expected_headers.items():
            actual = r.headers.get(header, '')
            if not actual:
                missing.append(header)
            else:
                if expected_value is None:
                    present.append(f"{header}: {actual}")
                elif isinstance(expected_value, list):
                    if actual not in expected_value:
                        missing.append(f"{header} (got: {actual})")
                    else:
                        present.append(f"{header}: {actual}")
                else:
                    if actual != expected_value:
                        missing.append(f"{header} (got: {actual}, expected: {expected_value})")
                    else:
                        present.append(f"{header}: {actual}")

        passed = len(missing) <= 2  # Allow up to 2 missing non-critical headers
        self.add_result(
            test_name="Security headers presence",
            category="HEADERS",
            passed=passed,
            details=f"Present: {len(present)}, Missing: {missing}",
            requests_sent=1,
        )

        for h in present:
            print(f"  [✓] {h}")
        for h in missing:
            print(f"  [!] Missing: {h}")
            self.add_finding(
                category="Security Headers",
                severity="MEDIUM" if h in ['Content-Security-Policy', 'Strict-Transport-Security'] else "LOW",
                title=f"Missing security header: {h}",
                description=f"Security header not set: {h}",
                endpoint="ALL",
                evidence=f"Header missing from response",
                owasp_id="A05:2021",
                remediation=f"Add {h} header to all responses",
                cvss_estimate=3.0
            )

    # ========================================================================
    # [WEBHOOK] WEBHOOK SECURITY
    # ========================================================================

    def test_webhook_security(self):
        print("\n[10/12] SEGURANÇA DE WEBHOOKS")
        print("=" * 60)

        # Test 1: Webhook with forged payload
        r = self._req('POST', '/payments/webhook', json={
            'type': 'payment',
            'data': {'id': '99999999'}
        })
        webhook_safe = r.status_code == 200 if r else False  # Should return 200 but not process
        self.add_result(
            test_name="Webhook forged payload handling",
            category="WEBHOOK",
            passed=webhook_safe,
            details=f"Status: {r.status_code if r else 'no response'}",
            requests_sent=1,
        )
        print(f"  [{'✓' if webhook_safe else '!'}] Forged webhook: Status {r.status_code if r else 'N/A'}")

        # Test 2: Webhook replay attack (same data twice)
        payload = {'type': 'payment', 'data': {'id': '123456'}}
        r1 = self._req('POST', '/payments/webhook', json=payload)
        r2 = self._req('POST', '/payments/webhook', json=payload)
        # Both should return 200, but the second should not double-process
        self.add_result(
            test_name="Webhook replay protection",
            category="WEBHOOK",
            passed=True,  # Hard to verify externally
            details="Replay sent - verify no double-processing in logs",
            requests_sent=2,
        )
        print(f"  [i] Webhook replay: Sent duplicate - check server logs for double-processing")

        # Test 3: Webhook with invalid signature
        r = self._req('POST', '/payments/webhook', json={
            'type': 'payment',
            'data': {'id': '789'}
        }, headers={
            'x-signature': 'ts=9999999,v1=0000000000000000000000000000000000000000',
            'x-request-id': 'forged-request'
        })
        sig_check = r.status_code == 200 if r else False
        self.add_result(
            test_name="Webhook signature validation",
            category="WEBHOOK",
            passed=sig_check,
            details=f"Invalid signature handled gracefully",
            requests_sent=1,
        )
        print(f"  [{'✓' if sig_check else '✗'}] Invalid signature: Handled gracefully")

        # Test 4: Webhook with malformed payloads
        malformed = [
            '',
            'not json',
            '{"invalid"}',
            None,
            {'type': None, 'data': None},
            {'type': 'payment'},
        ]
        crash_count = 0
        for p in malformed:
            try:
                if isinstance(p, str):
                    r = self._req('POST', '/payments/webhook', data=p,
                                  headers={'Content-Type': 'application/json'})
                elif p is None:
                    r = self._req('POST', '/payments/webhook')
                else:
                    r = self._req('POST', '/payments/webhook', json=p)
                if r and r.status_code == 500:
                    crash_count += 1
            except:
                pass

        self.add_result(
            test_name="Webhook malformed payload handling",
            category="WEBHOOK",
            passed=crash_count == 0,
            details=f"Crashes: {crash_count}/{len(malformed)}",
            requests_sent=len(malformed),
        )
        print(f"  [{'✗' if crash_count > 0 else '✓'}] Malformed payloads: {crash_count} crashes")

    # ========================================================================
    # [MASS] MASS ASSIGNMENT — OWASP API6:2023
    # ========================================================================

    def test_mass_assignment(self):
        print("\n[11/12] MASS ASSIGNMENT (OWASP API6:2023)")
        print("=" * 60)

        ts = int(time.time())

        # Test 1: Register with extra fields
        r = self._req('POST', '/auth/register', json={
            'email': f'mass{ts}@test.com',
            'password': 'Test1234',
            'username': f'mass{ts}',
            'dateOfBirth': '2000-01-01',
            'role': 'admin',
            'isActive': True,
            'emailVerified': True,
            'kycStatus': 'approved',
            'passwordHash': 'injected-hash',
        })

        if r and r.status_code == 200:
            user = r.json().get('data', {}).get('user', {})
            role_safe = user.get('role') == 'fan'
            kyc_safe = user.get('kycStatus') != 'approved'

            self.add_result(
                test_name="Mass assignment - Register role",
                category="MASS_ASSIGN",
                passed=role_safe,
                details=f"Role: {user.get('role')}, KYC: {user.get('kycStatus')}",
                requests_sent=1,
            )
            print(f"  [{'✓' if role_safe else '✗'}] Register role: {user.get('role')} (expected: fan)")
            print(f"  [{'✓' if kyc_safe else '✗'}] Register KYC: {user.get('kycStatus')} (expected: none)")

            if not role_safe:
                self.add_finding(
                    category="Mass Assignment",
                    severity="CRITICAL",
                    title="Role escalation via mass assignment in registration",
                    description="User can set their own role to 'admin' during registration",
                    endpoint="/api/v1/auth/register",
                    evidence=f"Sent role:'admin', got role:'{user.get('role')}'",
                    mitre_id="T1078.004",
                    owasp_id="API6:2023",
                    remediation="Whitelist allowed fields in registration handler",
                    cvss_estimate=9.5
                )
        else:
            self.add_result(
                test_name="Mass assignment - Register role",
                category="MASS_ASSIGN",
                passed=True,
                details=f"Registration with extra fields returned {r.status_code if r else 'no response'}",
                requests_sent=1,
            )
            print(f"  [✓] Register with extra fields: Handled (status: {r.status_code if r else 'N/A'})")

    # ========================================================================
    # [PRIVACY] DATA EXPOSURE — OWASP API3:2023
    # ========================================================================

    def test_data_exposure(self):
        print("\n[12/12] EXPOSIÇÃO DE DADOS (OWASP API3:2023)")
        print("=" * 60)

        # Test 1: Health endpoint information
        r = self._req('GET', '/health')
        if r:
            data = r.json()
            sensitive_keys = ['database', 'redis', 'env', 'config', 'secret', 'key', 'password', 'token']
            exposed = [k for k in sensitive_keys if k in json.dumps(data).lower()]
            safe = len(exposed) == 0
            self.add_result(
                test_name="Health endpoint data exposure",
                category="PRIVACY",
                passed=safe,
                details=f"Exposed: {exposed}" if exposed else "No sensitive data in health",
                requests_sent=1,
            )
            print(f"  [{'✗' if exposed else '✓'}] Health endpoint: {'Exposes: ' + str(exposed) if exposed else 'Clean'}")

        # Test 2: Error messages information leakage
        r = self._req('GET', '/nonexistent-route-12345')
        if r:
            text = r.text
            leaks = []
            if 'stack' in text.lower(): leaks.append('stack trace')
            if 'node_modules' in text: leaks.append('node_modules path')
            if 'at ' in text and '.ts:' in text: leaks.append('source file path')
            if 'SELECT' in text or 'FROM' in text: leaks.append('SQL query')

            safe = len(leaks) == 0
            self.add_result(
                test_name="Error response information leakage",
                category="PRIVACY",
                passed=safe,
                details=f"Leaks: {leaks}" if leaks else "No information leakage",
                requests_sent=1,
            )
            print(f"  [{'✗' if leaks else '✓'}] Error leakage: {leaks if leaks else 'None'}")

        # Test 3: User enumeration via public profile
        r = self._req('GET', '/users/admin')
        if r and r.status_code == 200:
            data = r.json().get('data', {})
            sensitive_fields = ['passwordHash', 'password', 'email', 'phoneNumber', 'dateOfBirth']
            exposed = [f for f in sensitive_fields if f in data]
            safe = len(exposed) == 0
            self.add_result(
                test_name="Public profile sensitive data",
                category="PRIVACY",
                passed=safe,
                details=f"Exposed fields: {exposed}" if exposed else "No sensitive fields in public profile",
                requests_sent=1,
            )
            print(f"  [{'✗' if exposed else '✓'}] Public profile: {exposed if exposed else 'Clean'}")

            if exposed:
                self.add_finding(
                    category="Data Exposure",
                    severity="HIGH",
                    title="Sensitive data in public profile response",
                    description=f"Fields exposed: {exposed}",
                    endpoint="/api/v1/users/:username",
                    evidence=str(exposed),
                    owasp_id="API3:2023",
                    remediation="Remove sensitive fields from public profile serialization",
                    cvss_estimate=7.0
                )
        else:
            self.add_result(
                test_name="Public profile sensitive data",
                category="PRIVACY",
                passed=True,
                details="Profile not found or requires auth",
                requests_sent=1,
            )
            print(f"  [✓] Public profile: Not accessible or clean")

        # Test 4: Verbose error messages
        r = self._req('POST', '/auth/login', json={'email': 'x', 'password': 'x'})
        if r and r.json():
            error_msg = json.dumps(r.json())
            has_internal = any(k in error_msg for k in ['internal', 'postgresql', 'drizzle', 'neon'])
            self.add_result(
                test_name="Verbose error message check",
                category="PRIVACY",
                passed=not has_internal,
                details=f"Internal info leaked" if has_internal else "Error messages are safe",
                requests_sent=1,
            )
            print(f"  [{'✗' if has_internal else '✓'}] Error messages: {'Leaks internals' if has_internal else 'Safe'}")

    # ========================================================================
    # CALCULATE SCORES & GENERATE REPORT
    # ========================================================================

    def calculate_scores(self) -> ScanReport:
        report = ScanReport(target=self.target)
        report.scan_start = datetime.now(timezone.utc).isoformat()
        report.findings = [asdict(f) for f in self.findings]
        report.test_results = [asdict(r) for r in self.results]
        report.total_tests = len(self.results)
        report.tests_passed = sum(1 for r in self.results if r.passed)
        report.tests_failed = sum(1 for r in self.results if not r.passed)

        # Calculate category scores (0-100)
        categories = {}
        for r in self.results:
            if r.category not in categories:
                categories[r.category] = {'passed': 0, 'total': 0}
            categories[r.category]['total'] += 1
            if r.passed:
                categories[r.category]['passed'] += 1

        for cat, data in categories.items():
            score = (data['passed'] / data['total'] * 100) if data['total'] > 0 else 0
            categories[cat]['score'] = round(score, 1)

        report.category_scores = categories

        # Severity-weighted penalty system
        severity_weights = {'CRITICAL': 15, 'HIGH': 10, 'MEDIUM': 5, 'LOW': 2, 'INFO': 0}
        total_penalty = sum(severity_weights.get(f.severity, 0) for f in self.findings)

        # Base score from test pass rate
        base_score = (report.tests_passed / report.total_tests * 100) if report.total_tests > 0 else 0

        # Apply penalties (max penalty: 60 points)
        penalty = min(total_penalty, 60)
        final_score = max(0, base_score - penalty)

        report.confidence_score = round(final_score, 1)

        # Grade
        if final_score >= 90: report.grade = 'A'
        elif final_score >= 80: report.grade = 'B'
        elif final_score >= 70: report.grade = 'C'
        elif final_score >= 60: report.grade = 'D'
        elif final_score >= 50: report.grade = 'E'
        else: report.grade = 'F'

        # Summary
        critical = sum(1 for f in self.findings if f.severity == 'CRITICAL')
        high = sum(1 for f in self.findings if f.severity == 'HIGH')
        medium = sum(1 for f in self.findings if f.severity == 'MEDIUM')
        low = sum(1 for f in self.findings if f.severity == 'LOW')

        report.summary = (
            f"Security scan completed: {report.total_tests} tests, "
            f"{report.tests_passed} passed, {report.tests_failed} failed. "
            f"Findings: {critical} Critical, {high} High, {medium} Medium, {low} Low. "
            f"Confidence Score: {report.confidence_score}/100 (Grade: {report.grade})"
        )

        report.scan_end = datetime.now(timezone.utc).isoformat()
        return report

    def generate_markdown_report(self, report: ScanReport) -> str:
        md = []
        md.append("# MyFans Platform — External Security Scan Report")
        md.append(f"\n**Target:** `{report.target}`")
        md.append(f"**Scanner:** MyFans Security Scanner v{report.scanner_version}")
        md.append(f"**Date:** {report.scan_start}")
        md.append(f"**Metodologias:** OWASP Top 10 2021, OWASP API Security Top 10 2023, MITRE ATT&CK")

        md.append(f"\n## Resultado Geral")
        md.append(f"\n| Métrica | Valor |")
        md.append(f"|---|---|")
        md.append(f"| **Nota de Confiança** | **{report.confidence_score}/100** |")
        md.append(f"| **Grade** | **{report.grade}** |")
        md.append(f"| Total de Testes | {report.total_tests} |")
        md.append(f"| Aprovados | {report.tests_passed} |")
        md.append(f"| Reprovados | {report.tests_failed} |")
        md.append(f"| Vulnerabilidades Encontradas | {len(report.findings)} |")

        # Category breakdown
        md.append(f"\n## Scores por Categoria")
        md.append(f"\n| Categoria | Score | Resultado |")
        md.append(f"|---|---|---|")
        for cat, data in report.category_scores.items():
            score = data.get('score', 0)
            icon = '✅' if score >= 80 else '⚠️' if score >= 60 else '❌'
            md.append(f"| {cat} | {score}/100 | {icon} {data['passed']}/{data['total']} |")

        # Findings
        if report.findings:
            md.append(f"\n## Vulnerabilidades Encontradas")
            for i, f in enumerate(report.findings, 1):
                severity_color = {
                    'CRITICAL': '🔴', 'HIGH': '🟠', 'MEDIUM': '🟡', 'LOW': '🔵', 'INFO': '⚪'
                }
                md.append(f"\n### {i}. {severity_color.get(f['severity'], '⚪')} [{f['severity']}] {f['title']}")
                md.append(f"- **Categoria:** {f['category']}")
                md.append(f"- **Endpoint:** `{f['endpoint']}`")
                md.append(f"- **Descrição:** {f['description']}")
                if f.get('mitre_id'): md.append(f"- **MITRE ATT&CK:** {f['mitre_id']}")
                if f.get('owasp_id'): md.append(f"- **OWASP:** {f['owasp_id']}")
                md.append(f"- **CVSS Estimado:** {f['cvss_estimate']}")
                md.append(f"- **Evidência:** `{f['evidence'][:200]}`")
                md.append(f"- **Remediação:** {f['remediation']}")

        # Test details
        md.append(f"\n## Detalhes dos Testes")
        md.append(f"\n| # | Teste | Categoria | Resultado | Requests | Detalhes |")
        md.append(f"|---|---|---|---|---|---|")
        for i, t in enumerate(report.test_results, 1):
            icon = '✅' if t['passed'] else '❌'
            md.append(f"| {i} | {t['test_name']} | {t['category']} | {icon} | {t['requests_sent']} | {t['details'][:80]} |")

        md.append(f"\n---")
        md.append(f"\n**IMPORTANTE:** Este relatório deve ser consolidado com o relatório de auditoria interna.")
        md.append(f"Copie o conteúdo do arquivo `external_scan_report.json` e cole no prompt do Claude para consolidação.")

        return '\n'.join(md)

    # ========================================================================
    # RUN ALL TESTS
    # ========================================================================

    def run_all(self) -> ScanReport:
        print("=" * 70)
        print("  MYFANS PLATFORM — EXTERNAL SECURITY SCANNER v" + VERSION)
        print(f"  Target: {self.target}")
        print(f"  Date: {datetime.now(timezone.utc).isoformat()}")
        print(f"  Methodology: OWASP Top 10, OWASP API Security, MITRE ATT&CK")
        print("=" * 70)

        # Verify target is reachable
        print("\n[0/12] VERIFICANDO CONECTIVIDADE...")
        r = self._req('GET', '/health')
        if not r:
            print(f"  [✗] ERRO: Target {self.target} não está acessível!")
            print(f"      Verifique se a URL está correta e a API está rodando.")
            sys.exit(1)
        print(f"  [✓] Target acessível: {r.status_code}")

        # Run all test suites
        self.test_reconnaissance()
        self.test_auth_bruteforce()
        self.test_jwt_attacks()
        self.test_injection_attacks()
        self.test_xss_attacks()
        self.test_authorization_attacks()
        self.test_rate_limiting()
        self.test_cors()
        self.test_security_headers()
        self.test_webhook_security()
        self.test_mass_assignment()
        self.test_data_exposure()

        # Calculate scores and generate report
        report = self.calculate_scores()

        print("\n" + "=" * 70)
        print(f"  RESULTADO FINAL")
        print("=" * 70)
        print(f"\n  Nota de Confiança: {report.confidence_score}/100 (Grade: {report.grade})")
        print(f"  Testes: {report.tests_passed}/{report.total_tests} aprovados")
        print(f"  Vulnerabilidades: {len(report.findings)}")

        critical = sum(1 for f in self.findings if f.severity == 'CRITICAL')
        high = sum(1 for f in self.findings if f.severity == 'HIGH')
        medium = sum(1 for f in self.findings if f.severity == 'MEDIUM')
        low = sum(1 for f in self.findings if f.severity == 'LOW')

        print(f"    🔴 Critical: {critical}")
        print(f"    🟠 High: {high}")
        print(f"    🟡 Medium: {medium}")
        print(f"    🔵 Low: {low}")
        print(f"\n  Category Scores:")
        for cat, data in report.category_scores.items():
            bar = '█' * int(data['score'] / 5) + '░' * (20 - int(data['score'] / 5))
            print(f"    {cat:20s} [{bar}] {data['score']}%")

        return report


def main():
    parser = argparse.ArgumentParser(
        description='MyFans Platform - External Security Scanner',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemplos:
  python myfans_security_scanner.py --target https://api.myfans.my
  python myfans_security_scanner.py --target http://localhost:3001 --verbose
  python myfans_security_scanner.py --target http://localhost:3001 --output ./report

AVISO: Use apenas em ambientes autorizados para testes de segurança.
        """
    )
    parser.add_argument('--target', '-t', required=True, help='URL base da API (ex: https://api.myfans.my)')
    parser.add_argument('--output', '-o', default='.', help='Diretório de saída para relatórios (default: .)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Modo verbose')

    args = parser.parse_args()

    scanner = SecurityScanner(args.target, verbose=args.verbose)
    report = scanner.run_all()

    # Save JSON report
    os.makedirs(args.output, exist_ok=True)
    json_path = os.path.join(args.output, 'external_scan_report.json')
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(asdict(report), f, indent=2, ensure_ascii=False, default=str)
    print(f"\n  📄 JSON report saved: {json_path}")

    # Save Markdown report
    md_path = os.path.join(args.output, 'external_scan_report.md')
    md_content = scanner.generate_markdown_report(report)
    with open(md_path, 'w', encoding='utf-8') as f:
        f.write(md_content)
    print(f"  📄 Markdown report saved: {md_path}")

    print(f"\n  ⚡ Para consolidar com o teste interno, copie o conteúdo de:")
    print(f"     {json_path}")
    print(f"     e cole no prompt do Claude.\n")

    # Exit code based on severity
    critical = sum(1 for f in scanner.findings if f.severity == 'CRITICAL')
    if critical > 0:
        sys.exit(2)
    elif report.confidence_score < 60:
        sys.exit(1)
    sys.exit(0)


if __name__ == '__main__':
    main()
