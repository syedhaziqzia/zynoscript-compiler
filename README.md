<p align="center">
  <img src="public/assets/Zynoscript-Logo.jpg" alt="ZynoScript Logo" width="120" style="border-radius: 16px; margin-bottom: 8px;"/>
</p>

<h1 align="center">ZynoScript Compiler Studio</h1>

<p align="center">
  <strong>A full-stack, web-based compiler construction workbench with real-time pipeline stages, dynamic grammar customization, and telemetry.</strong>
</p>

<p align="center">
  <a href="https://your-project.vercel.app"><img src="https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel&logoColor=white" alt="Live Demo"/></a>
  <a href="#running-the-test-suite"><img src="https://img.shields.io/badge/Tests-40%20passing-success?logo=pytest&logoColor=white" alt="Tests"/></a>
  <a href="https://fastapi.tiangolo.com"><img src="https://img.shields.io/badge/FastAPI-0.110%2B-009688?logo=fastapi&logoColor=white" alt="FastAPI"/></a>
  <a href="https://neon.tech"><img src="https://img.shields.io/badge/Database-Neon%20Postgres-00E599?logo=postgresql&logoColor=white" alt="Neon Postgres"/></a>
  <a href="https://www.python.org"><img src="https://img.shields.io/badge/Python-3.12%2B-blue?logo=python&logoColor=white" alt="Python Version"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT"/></a>
</p>

<p align="center">
  <img src="public/assets/compiler-workbench.png" alt="ZynoScript Compiler Workbench" width="100%" style="border-radius: 12px; border: 1px solid #e1e4e8; box-shadow: 0 10px 30px rgba(0,0,0,0.08);"/>
</p>

---

## 👥 Authors & Credits

This project was developed for the **Compiler Construction Lab Project**:

* **Backend Lead & Core Compiler Architecture:**  
  *Co-developed the foundational compiler engine, grammar specifications, and core backend stages.*  
  👉 **[Syed Abdul Ali Naqvi](https://github.com/SyedAbdulAliNaqvi)**

* **Full-Stack Engineering, UX & Cloud Infrastructure:**  
  *Designed the studio workbench interface, dynamic grammar engine, session security, test suite, and Vercel/Neon deployment.*  
  👉 **[Syed Haziq Zia](https://github.com/syedhaziqzia)**

---

## 🎯 Problem Statement

Traditional compiler toolchains (such as Lex, Yacc, and Flex/Bison) operate as black boxes, providing terminal output only after compilation completes or fails. For students and engineers learning compiler construction, inspecting the internal state of each phase—Token streams, Abstract Syntax Trees (AST), Symbol Tables, Type Verification, Intermediate Three-Address Code (TAC), and Virtual Machine memory—is notoriously difficult.

**ZynoScript Compiler Studio** solves this by delivering an interactive laboratory IDE where:
1. Every compilation phase operates as an isolated, inspectable pure function.
2. Grammar rules (keywords, operator symbols) can be rebound dynamically in real-time.
3. Errors pinpoint the exact blocking stage with actionable diagnostic feedback.
4. Telemetry logs and compiler performance metrics are tracked across sessions.

---

## 📸 Interface Showcase

### 1. Welcome & Authentication Gateway
Features secure registration and login, session persistence controls, and interactive floating compiler tokens:

<p align="center">
  <img src="public/assets/welcome-auth.png" alt="ZynoScript Welcome & Sign In" width="100%" style="border-radius: 10px; border: 1px solid #e1e4e8;"/>
</p>

### 2. Interactive Compiler Workbench
Central laboratory IDE with line-numbered code editing, stage tabs (Lexical, Syntax, Semantic, ICG, Output), console terminal, and runtime variable inspector:

<p align="center">
  <img src="public/assets/compiler-workbench.png" alt="ZynoScript Compiler Workbench" width="100%" style="border-radius: 10px; border: 1px solid #e1e4e8;"/>
</p>

### 3. Language Reference & Specification
In-app specification sheet listing active keywords, custom operator overrides, data types, and formal grammar BNF rules:

<p align="center">
  <img src="public/assets/language-reference.png" alt="ZynoScript Language Reference" width="100%" style="border-radius: 10px; border: 1px solid #e1e4e8;"/>
</p>

---

## 🔄 The 5 Compiler Stages

Every stage lives in [`app/engines/`](app/engines/) as an independent pure engine:

| Stage | Module | Input | Output / Inspection Data |
|---|---|---|---|
| **01. Lexical** | `lexical.py` | Source Code | Token stream, identifiers, symbol categories, lexical errors |
| **02. Syntax** | `syntax.py` | Token Stream | Abstract Syntax Tree (JSON & ASCII tree), parsing errors |
| **03. Semantic** | `semantic.py` | AST | Symbol Table, scope hierarchy, type verification (Rules 1–7) |
| **04. ICG** | `icg.py` | AST | Three-Address Code (TAC), Quadruple table `(op, arg1, arg2, res)` |
| **05. VM Runtime** | `output.py` | AST | Virtual machine execution, terminal output, final variable states |

---

## 💻 ZynoScript Syntax Cheat Sheet

Every valid ZynoScript program must end with `halt;`:

```zynoscript
let whole counter := 1;
let whole maxLimit := 5;

spin (counter <<= maxLimit) {
    whenTrue (counter ~= 3) {
        beam "Three reached!";
    } elseWay {
        beam counter;
    }
    counter := counter +~ 1;
}

beam "Execution complete.";
halt;
```

* **Types:** `whole` (int), `part` (float), `phrase` (str), `flag` (bool), `mark` (char)
* **Control Flow:** `whenTrue (cond) { ... } elseWay { ... }`, `spin (cond) { ... }`
* **Operators:** `+~`, `-~`, `*~`, `/~` (Arithmetic) | `=>>`, `<<=`, `~=`, `~!` (Comparison)
* **Output & Terminate:** `beam <expr>;` | `halt;`

---

## 🚀 Quick Start (Localhost vs. Production)

### Running Locally (Localhost)
Running locally uses a zero-configuration SQLite database (`data/zynoscript.db`) and runs on your computer:

```bash
# 1. Clone repository
git clone https://github.com/<your-username>/zynoscript-compiler.git
cd zynoscript-compiler

# 2. Create virtual environment
python -m venv .venv
# On Windows PowerShell:
.venv\Scripts\Activate.ps1
# On macOS/Linux:
# source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Start local development server
uvicorn app.main:app --reload
```
* Studio UI: [http://127.0.0.1:8000](http://127.0.0.1:8000)
* API Swagger Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

> [!NOTE]
> **Do Localhost and Vercel clash?**  
> **No.** Localhost runs only on your computer (`127.0.0.1:8000`) using local SQLite. Vercel runs in the cloud using Neon PostgreSQL. They are completely separate environments and never interfere with each other.

---

### Deploying to Vercel (100% Free Cloud Hosting)

1. Create a free PostgreSQL database at [Neon.tech](https://neon.tech) and copy your connection string (`postgresql://...`).
2. Push this repository to your GitHub account.
3. Import the repository in [Vercel](https://vercel.com).
4. In Vercel's **Settings → Environment Variables**, add:
   * `DATABASE_URL`: *(Your Neon PostgreSQL connection string)*
   * `ADMIN_USERNAME`: *(Optional: your desired administrator username)*
   * `ADMIN_PASSWORD`: *(Optional: your desired administrator password)*
5. Click **Deploy**. Vercel will host the studio on its global CDN and execute API requests serverless 24/7.

> [!TIP]
> **Do you need to keep your PC on or maintain Vercel?**  
> **No.** Vercel runs automatically in the cloud. You do not need to keep anything running locally.

---

## 🛡️ Security & Administrator Access

* **Abuse-Proof Public Access:** Public web registrations are strictly granted standard `user` accounts. No visitor can elevate themselves to administrator through the web interface.
* **Administrator Provisioning:** Administrator accounts can only be provisioned by setting `ADMIN_USERNAME` and `ADMIN_PASSWORD` in server environment variables (in `.env` or Vercel dashboard).
* **Timing-Safe Auth:** Passwords use salted PBKDF2-HMAC-SHA256 (120,000 iterations) with `secrets.compare_digest` and constant-time dummy verification.
* **SQL Injection Immunity:** 100% of database queries use parameterized placeholders (`?` / `%s`).
* **HTTP Security Headers:** Includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, and `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 🧪 Running the Test Suite

Execute the 40 automated integration and unit tests:

```bash
python -m unittest discover tests
```

---

## 📁 Project Structure

```text
zynoscript-compiler/
├── app/
│   ├── main.py                  # FastAPI application, CORS, cyber security headers & static mount
│   ├── config.py                # Environment-driven settings & security bounds
│   ├── db.py                    # Dual SQLite/PostgreSQL connection & schema manager
│   ├── auth.py                  # Cryptographic PBKDF2 hashing & session management
│   ├── logs.py                  # Telemetry recording and audit logging
│   ├── pipeline.py              # 5-stage compiler pipeline orchestrator
│   ├── engines/                 # Pure compiler modules (zero web dependencies)
│   │   ├── grammar.py           # Dynamic grammar specifications & BNF generator
│   │   ├── lexical.py           # Tokenizer & symbol table scanner
│   │   ├── syntax.py            # Recursive-descent AST parser
│   │   ├── semantic.py          # Type verification & scope hierarchy rules
│   │   ├── icg.py               # TAC (Three-Address Code) & quadruples generator
│   │   └── output.py            # AST interpreter & virtual machine runtime
│   └── routes/                  # REST API routes (auth, compiler, grammar, logs, admin)
├── api/
│   └── index.py                 # Vercel serverless function entrypoint
├── public/                      # Static studio frontend (HTML, CSS, JS, Assets)
├── tests/                       # 40 automated tests (APIs, engines, permissions, security)
├── data/                        # Local SQLite database directory
├── .env.example                 # Configuration template
├── vercel.json                  # Vercel serverless rewrite rules
├── requirements.txt             # Minimal Python dependencies
└── README.md                    # Project documentation
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
