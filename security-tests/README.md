# FanDreams Security Testing Suite

## Estrutura

```
security-tests/
├── internal/                         # Testes internos (white-box)
│   └── security-audit.test.ts        # Suite de testes Vitest contra a API Hono
├── external/                         # Testes externos (black-box)
│   ├── fandreams_security_scanner.py    # Script Python para ataque externo
│   └── requirements.txt              # Dependências Python
├── reports/                          # Relatórios
│   └── SECURITY_AUDIT_REPORT.md      # Relatório de auditoria interna
└── README.md
```

## Teste Interno (White-box)

Executa testes diretamente contra o Hono app sem rede:

```bash
cd /home/user/fandreams
npx vitest run security-tests/internal/security-audit.test.ts
```

## Teste Externo (Black-box) — Para CodeSandbox

1. Copie o arquivo `external/fandreams_security_scanner.py` para o CodeSandbox
2. Instale dependências: `pip install requests`
3. Execute:

```bash
python fandreams_security_scanner.py --target https://api.fandreams.app --verbose
```

4. Copie o conteúdo de `external_scan_report.json` gerado
5. Cole no prompt do Claude com: "Consolide este relatório externo com a auditoria interna"

## Consolidação

A nota final é calculada como:
- Teste Interno (White-box): 60% do peso
- Teste Externo (Black-box): 40% do peso
