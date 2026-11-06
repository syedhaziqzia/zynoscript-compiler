/* ZynoScript Compiler Studio - Browser UI
   Sections: Helpers, Auth, Studio View Toggles, Grammar Editor, Code Editor, Compiler Engines, Output Renderers, Activity Log, Admin. */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STAGES = ["lexical", "syntax", "semantic", "icg", "output"];
const STAGE_TITLE = {
  lexical: "Lexical Analysis",
  syntax: "Syntax Analysis",
  semantic: "Semantic Analysis",
  icg: "Intermediate Code Generation",
  output: "Program Output"
};
const ACTIONS = [
  "login", "logout", "register", "grammar_update", "grammar_reset",
  "run_lexical", "run_syntax", "run_semantic", "run_icg", "run_output",
  "admin_reset_password", "admin_set_role", "admin_delete_user"
];

const state = {
  user: null,
  grammar: null,
  draft: null,
  gtab: "keywords",
  selected: null,
  authMode: "login",
  lexTab: "tokens",
  icgTab: "tac",
  lastResults: null,
};

function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  t.classList.remove("is-visible");
  void t.offsetWidth;
  t.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    t.classList.remove("is-visible");
    setTimeout(() => { if (!t.classList.contains("is-visible")) t.hidden = true; }, 220);
  }, 2200);
}

/* ---------- Custom Rounded Dropdown System (No square native OS popups) ---------- */
function enhanceSelect(select) {
  if (!select) return null;
  if (select._enhanced) {
    select._enhanced.rebuild();
    return select._enhanced;
  }

  // Hide native select visually but keep it functional for change events and form data
  select.classList.add("custom-select-native");
  select.setAttribute("tabindex", "-1");
  select.setAttribute("aria-hidden", "true");

  const wrap = document.createElement("div");
  wrap.className = "custom-select-wrap";
  if (select.id === "sample") wrap.classList.add("align-right");
  if (select.hidden) wrap.hidden = true;

  select.parentNode.insertBefore(wrap, select);
  wrap.appendChild(select);

  // Trigger button
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "custom-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const ariaLabel = select.getAttribute("aria-label") || select.getAttribute("aria-labelledby");
  if (ariaLabel) trigger.setAttribute("aria-label", ariaLabel);

  const labelSpan = document.createElement("span");
  labelSpan.className = "custom-select-label";

  const arrowSpan = document.createElement("span");
  arrowSpan.className = "custom-select-arrow";
  arrowSpan.setAttribute("aria-hidden", "true");
  arrowSpan.innerHTML = typeof icon === "function" ? icon("chevron") : `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>`;

  trigger.appendChild(labelSpan);
  trigger.appendChild(arrowSpan);
  wrap.appendChild(trigger);

  // Custom rounded dropdown list
  const menu = document.createElement("div");
  menu.className = "custom-select-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  wrap.appendChild(menu);

  const checkIcon = `<svg class="ico cs-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;

  function syncValue() {
    const selOpt = select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
    labelSpan.textContent = selOpt ? selOpt.text : (select.value || "");

    Array.from(menu.children).forEach((child) => {
      const isMatch = child.dataset.value === select.value;
      child.classList.toggle("is-selected", isMatch);
      child.setAttribute("aria-selected", String(isMatch));
    });
  }

  function rebuild() {
    menu.innerHTML = "";
    const opts = Array.from(select.options || []);
    opts.forEach((opt) => {
      const item = document.createElement("div");
      item.className = "custom-select-item" + (opt.value === select.value ? " is-selected" : "");
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(opt.value === select.value));
      item.dataset.value = opt.value;
      item.innerHTML = `<span>${esc(opt.text || opt.value)}</span>${checkIcon}`;

      item.addEventListener("click", (e) => {
        e.stopPropagation();
        if (select.value !== opt.value) {
          select.value = opt.value;
          syncValue();
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        close();
        trigger.focus();
      });
      menu.appendChild(item);
    });
    syncValue();
  }

  function open() {
    document.querySelectorAll(".custom-select-wrap.is-open").forEach((w) => {
      if (w !== wrap && w._closeCustomSelect) w._closeCustomSelect();
    });
    if (typeof toggleProfileDropdown === "function") toggleProfileDropdown(false);

    wrap.classList.add("is-open");
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  function close() {
    wrap.classList.remove("is-open");
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function toggle() {
    if (wrap.classList.contains("is-open")) close();
    else open();
  }

  wrap._closeCustomSelect = close;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    toggle();
  });

  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!wrap.classList.contains("is-open")) {
        open();
      } else {
        const items = Array.from(menu.children);
        if (!items.length) return;
        const idx = items.findIndex((it) => it.classList.contains("is-selected"));
        const nextIdx = e.key === "ArrowDown" ? Math.min(items.length - 1, idx + 1) : Math.max(0, idx - 1);
        if (items[nextIdx]) items[nextIdx].click();
      }
    } else if (e.key === "Escape") {
      close();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });

  // Watch for dynamic options updates and attribute changes
  const observer = new MutationObserver(() => {
    wrap.hidden = select.hidden;
    if (select.disabled) trigger.setAttribute("disabled", "");
    else trigger.removeAttribute("disabled");
    rebuild();
  });
  observer.observe(select, { childList: true, attributes: true, subtree: true, attributeFilter: ["hidden", "disabled"] });

  // Intercept programmatic value setter
  const valDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (valDesc && valDesc.set) {
    Object.defineProperty(select, "value", {
      get() {
        return valDesc.get.call(this);
      },
      set(val) {
        valDesc.set.call(this, val);
        syncValue();
      },
      configurable: true
    });
  }

  const idxDesc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "selectedIndex");
  if (idxDesc && idxDesc.set) {
    Object.defineProperty(select, "selectedIndex", {
      get() {
        return idxDesc.get.call(this);
      },
      set(val) {
        idxDesc.set.call(this, val);
        syncValue();
      },
      configurable: true
    });
  }

  let isHidden = select.hidden;
  Object.defineProperty(select, "hidden", {
    get() {
      return isHidden;
    },
    set(val) {
      isHidden = Boolean(val);
      if (isHidden) select.setAttribute("hidden", "");
      else select.removeAttribute("hidden");
      wrap.hidden = isHidden;
    },
    configurable: true
  });

  rebuild();

  const api = { rebuild, syncValue, open, close, wrap, trigger, menu };
  select._enhanced = api;
  return api;
}

window.addEventListener("click", (e) => {
  document.querySelectorAll(".custom-select-wrap.is-open").forEach((wrap) => {
    if (!wrap.contains(e.target) && wrap._closeCustomSelect) wrap._closeCustomSelect();
  });
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".custom-select-wrap.is-open").forEach((wrap) => {
      if (wrap._closeCustomSelect) wrap._closeCustomSelect();
    });
  }
});

/* ---------- View Navigation ---------- */
function showView(name) {
  if (typeof toggleProfileDropdown === "function") toggleProfileDropdown(false);
  const topbar = $("#topbar");
  if (topbar) topbar.hidden = name === "auth";
  for (const v of ["auth", "workbench", "guide", "activity", "admin"]) {
    const el = $(`#${v}-view`);
    if (!el) continue;
    const show = v === name;
    if (show && el.hidden) {
      el.classList.remove("view-enter");
      void el.offsetWidth;
      el.classList.add("view-enter");
    }
    el.hidden = !show;
  }
  $$(".nav-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.view === name));
  if (name === "activity") {
    if (state.user && state.user.role === "admin") {
      fillUserFilter();
    }
    loadLogs();
  }
  if (name === "admin") loadAdminDashboard();

  if (name === "guide") renderGuide();
  if (name === "auth" && typeof window._startAuthCompilerCanvas === "function") {
    window._startAuthCompilerCanvas();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- Authentication ---------- */
function renderAuthError(message, action = null, actionUser = null) {
  const errBox = $("#auth-error");
  if (!errBox) return;
  if (!message) {
    errBox.innerHTML = "";
    errBox.hidden = true;
    return;
  }

  errBox.hidden = false;
  let html = `<span class="form-error-icon" aria-hidden="true">!</span><div class="form-error-body"><span class="form-error-msg">${esc(message)}</span>`;

  if (action === "register") {
    html += `<button type="button" class="auth-switch-btn" data-switch="register" data-user="${esc(actionUser || '')}">Create account for "${esc(actionUser || '')}" &rarr;</button>`;
  } else if (action === "login") {
    html += `<button type="button" class="auth-switch-btn" data-switch="login" data-user="${esc(actionUser || '')}">Sign in as "${esc(actionUser || '')}" &rarr;</button>`;
  }

  html += `</div>`;
  errBox.innerHTML = html;

  const switchBtn = errBox.querySelector(".auth-switch-btn");
  if (switchBtn) {
    switchBtn.addEventListener("click", () => {
      const mode = switchBtn.dataset.switch;
      const user = switchBtn.dataset.user;
      setAuthMode(mode);
      if (user) $("#auth-user").value = user;
      $("#auth-pass").value = "";
      $("#auth-pass").focus();
      renderAuthError("");
    });
  }

  const card = $(".auth-card");
  if (card) {
    card.classList.remove("shake");
    void card.offsetWidth;
    card.classList.add("shake");
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  $$(".tab[data-mode]").forEach((t) => t.classList.toggle("is-active", t.dataset.mode === mode));
  $("#auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
  $("#auth-pass").autocomplete = mode === "login" ? "current-password" : "new-password";
  renderAuthError("");
}

async function enterApp(user) {
  state.user = user;
  if (typeof toggleProfileDropdown === "function") toggleProfileDropdown(false);
  $("#who-name").textContent = user.username;
  $("#who-role").textContent = `${user.role} account`;
  $("#who-avatar").textContent = user.username.slice(0, 1).toUpperCase();
  const isAdmin = user.role === "admin";
  const gram = await Api.get("/api/grammar");
  setGrammar(gram);
  if (isAdmin) {
    try { await fillUserFilter(); } catch { /* filter optional */ }
  }
  const topbar = $("#topbar");
  if (topbar) topbar.hidden = false;
  $("#nav").hidden = $("#whoami").hidden = $("#cmd-trigger").hidden = false;
  $("#nav-admin").hidden = $("#log-user").hidden = !isAdmin;
  showView("workbench");
  if (typeof toggleProfileDropdown === "function") toggleProfileDropdown(false);
}

function leaveApp(message) {
  Api.setToken("");
  state.user = null;
  const topbar = $("#topbar");
  if (topbar) topbar.hidden = true;
  $("#nav").hidden = $("#whoami").hidden = $("#cmd-trigger").hidden = true;
  $("#nav-admin").hidden = $("#log-user").hidden = true;
  toggleProfileDropdown(false);
  closeGrammarDrawer();
  showView("auth");
  if (message) renderAuthError(message);
}

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const userField = $("#auth-user");
  const passField = $("#auth-pass");
  const username = userField.value.trim();
  const password = passField.value;

  // Immediate client-side validation for crisp user feedback
  if (!username) {
    renderAuthError("Please enter your username.");
    userField.focus();
    return;
  }
  if (username.length < 3) {
    renderAuthError("Username must be at least 3 characters long.");
    userField.focus();
    return;
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(username)) {
    renderAuthError("Usernames can only contain letters, numbers, hyphens, dots, and underscores (no spaces).");
    userField.focus();
    return;
  }
  if (!password) {
    renderAuthError("Please enter your password.");
    passField.focus();
    return;
  }
  if (password.length < 6) {
    renderAuthError("Password must be at least 6 characters long.");
    passField.focus();
    return;
  }

  const btn = $("#auth-submit");
  btn.disabled = true;
  renderAuthError("");
  try {
    const remember = $("#auth-remember").checked;
    const res = await Api.post(`/api/auth/${state.authMode}`, {
      username,
      password,
      remember
    });
    Api.setToken(res.token, remember);
    remember ? localStorage.setItem("zs_user", res.user.username) : localStorage.removeItem("zs_user");
    passField.value = "";
    await enterApp(res.user);
  } catch (err) {
    renderAuthError(err.message, err.action, err.actionUser || username);
  } finally {
    btn.disabled = false;
  }
});

$$(".tab[data-mode]").forEach((t) => t.addEventListener("click", () => setAuthMode(t.dataset.mode)));

$("#pw-toggle").addEventListener("click", (e) => {
  const input = $("#auth-pass"), show = input.type === "password";
  input.type = show ? "text" : "password";
  e.currentTarget.textContent = show ? "Hide" : "Show";
  e.currentTarget.setAttribute("aria-pressed", String(show));
});

/* ---------- Interactive Compiler Syntax & AST Canvas for Auth Background ---------- */
(function initAuthCompilerCanvas() {
  const canvas = $("#auth-compiler-canvas");
  const authView = $("#auth-view");
  if (!canvas || !authView) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const COMPILER_DATA = [
    // AST Grammar Nodes
    { type: "AST", text: "<Program>", tag: "ROOT" },
    { type: "AST", text: "<StmtList>", tag: "BLOCK" },
    { type: "AST", text: "<VarDecl>", tag: "DECL" },
    { type: "AST", text: "<AssignStmt>", tag: "ASSIGN" },
    { type: "AST", text: "<WhenTrue>", tag: "BRANCH" },
    { type: "AST", text: "<ElseWay>", tag: "BRANCH" },
    { type: "AST", text: "<BinaryExpr>", tag: "EXPR" },
    { type: "AST", text: "<BeamOutput>", tag: "I/O" },
    { type: "AST", text: "<HaltNode>", tag: "TERM" },
    { type: "AST", text: "<Condition>", tag: "COND" },

    // Lexer Tokens
    { type: "LEX", text: "let", tag: "KEYWORD" },
    { type: "LEX", text: ":=", tag: "ASSIGN" },
    { type: "LEX", text: "whenTrue", tag: "KEYWORD" },
    { type: "LEX", text: "elseWay", tag: "KEYWORD" },
    { type: "LEX", text: "beam", tag: "KEYWORD" },
    { type: "LEX", text: "halt", tag: "KEYWORD" },
    { type: "LEX", text: "<<=", tag: "OP_LE" },
    { type: "LEX", text: "==", tag: "OP_EQ" },
    { type: "LEX", text: "!=", tag: "OP_NE" },
    { type: "LEX", text: ";", tag: "SEMI" },
    { type: "LEX", text: "TOK_IDENT", tag: "ID" },
    { type: "LEX", text: "TOK_INT", tag: "NUM" },

    // Intermediate Code / Quadruples (TAC)
    { type: "TAC", text: "t1 := 5", tag: "IR_QUAD" },
    { type: "TAC", text: "t2 := x <<= y", tag: "IR_QUAD" },
    { type: "TAC", text: "if_false t2 goto L1", tag: "IR_GOTO" },
    { type: "TAC", text: "quad[0]: (:=, 5, -, x)", tag: "QUAD" },
    { type: "TAC", text: "quad[1]: (<<=, x, y, t2)", tag: "QUAD" },
    { type: "TAC", text: "emit_tac(t1)", tag: "EMIT" },

    // Semantic & Types
    { type: "SEM", text: "symtab.lookup('x')", tag: "SCOPE" },
    { type: "SEM", text: "typecheck(whole)", tag: "SEMANTIC" },
    { type: "TYPE", text: "type: whole", tag: "TYPE_INT" },
    { type: "TYPE", text: "type: fraction", tag: "TYPE_FLOAT" },
    { type: "TYPE", text: "type: truth", tag: "TYPE_BOOL" },

    // Stages
    { type: "STAGE", text: "[01: LEXER]", tag: "PHASE 1" },
    { type: "STAGE", text: "[02: PARSER]", tag: "PHASE 2" },
    { type: "STAGE", text: "[03: SEMANTIC]", tag: "PHASE 3" },
    { type: "STAGE", text: "[04: ICG_TAC]", tag: "PHASE 4" },
    { type: "STAGE", text: "[05: CODEGEN]", tag: "PHASE 5" }
  ];

  let width = 0, height = 0;
  let dpr = window.devicePixelRatio || 1;
  let nodes = [];
  let trailParticles = [];
  let animId = null;

  const mouse = {
    x: -9999,
    y: -9999,
    active: false,
    prevX: -9999,
    prevY: -9999
  };

  // Get tight bounding boxes of individual text and card elements (no gigantic dead blocks)
  function getContentBoxes() {
    const canvasRect = canvas.getBoundingClientRect();
    const boxes = [];
    const pad = 8; // Clean 8px buffer around actual text elements

    // 1. Auth Card
    const card = authView.querySelector(".auth-card");
    if (card) {
      const cr = card.getBoundingClientRect();
      boxes.push({
        left: cr.left - canvasRect.left - pad,
        top: cr.top - canvasRect.top - pad,
        right: cr.right - canvasRect.left + pad,
        bottom: cr.bottom - canvasRect.top + pad
      });
    }

    // 2. Logo
    const logo = authView.querySelector(".hero-logo");
    if (logo) {
      const lr = logo.getBoundingClientRect();
      boxes.push({
        left: lr.left - canvasRect.left - pad,
        top: lr.top - canvasRect.top - pad,
        right: lr.right - canvasRect.left + pad,
        bottom: lr.bottom - canvasRect.top + pad
      });
    }

    // 3. Hero Heading (h1)
    const h1 = authView.querySelector(".auth-hero h1");
    if (h1) {
      const hr = h1.getBoundingClientRect();
      boxes.push({
        left: hr.left - canvasRect.left - pad,
        top: hr.top - canvasRect.top - pad,
        right: hr.right - canvasRect.left + pad,
        bottom: hr.bottom - canvasRect.top + pad
      });
    }

    // 4. Hero Lead Text (.lead)
    const lead = authView.querySelector(".auth-hero .lead");
    if (lead) {
      const lr = lead.getBoundingClientRect();
      boxes.push({
        left: lr.left - canvasRect.left - pad,
        top: lr.top - canvasRect.top - pad,
        right: lr.right - canvasRect.left + pad,
        bottom: lr.bottom - canvasRect.top + pad
      });
    }

    // 5. Hero Pipeline Preview (.hero-pipeline-preview)
    const pipeline = authView.querySelector(".hero-pipeline-preview");
    if (pipeline) {
      const pr = pipeline.getBoundingClientRect();
      boxes.push({
        left: pr.left - canvasRect.left - pad,
        top: pr.top - canvasRect.top - pad,
        right: pr.right - canvasRect.left + pad,
        bottom: pr.bottom - canvasRect.top + pad
      });
    }

    // 6. Hero Code Card (.hero-code-card)
    const codeCard = authView.querySelector(".hero-code-card");
    if (codeCard) {
      const ccr = codeCard.getBoundingClientRect();
      boxes.push({
        left: ccr.left - canvasRect.left - pad,
        top: ccr.top - canvasRect.top - pad,
        right: ccr.right - canvasRect.left + pad,
        bottom: ccr.bottom - canvasRect.top + pad
      });
    }

    return boxes;
  }

  // Smooth proximity factor from 0.0 (inside content) to 1.0 (in open background)
  // Uses smoothstep (cubic Hermite) with a clean 18px feather so elements fade seamlessly
  function getContentProximity(x, y, boxes, featherDist = 18) {
    if (!boxes || !boxes.length) return 1;
    let minDist = 99999;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const dx = Math.max(0, b.left - x, x - b.right);
      const dy = Math.max(0, b.top - y, y - b.bottom);
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) minDist = dist;
    }
    if (minDist <= 0) return 0;
    if (minDist >= featherDist) return 1;
    const t = minDist / featherDist;
    return t * t * (3 - 2 * t);
  }

  function spawnNode(item, boxes) {
    const cardEl = authView.querySelector(".auth-card");
    const codeEl = authView.querySelector(".hero-code-card") || authView.querySelector(".auth-hero");
    const canvasRect = canvas.getBoundingClientRect();

    const heroRight = codeEl ? codeEl.getBoundingClientRect().right - canvasRect.left : width * 0.46;
    const cardLeft = cardEl ? cardEl.getBoundingClientRect().left - canvasRect.left : width * 0.54;
    const heroLeft = codeEl ? codeEl.getBoundingClientRect().left - canvasRect.left : width * 0.08;
    const cardRight = cardEl ? cardEl.getBoundingClientRect().right - canvasRect.left : width * 0.92;

    for (let attempt = 0; attempt < 30; attempt++) {
      let x, y;
      const zoneChoice = Math.random();

      if (zoneChoice < 0.22) {
        // Zone 1: Top area across full width (top margin)
        x = 15 + Math.random() * (width - 30);
        y = 15 + Math.random() * 125;
      } else if (zoneChoice < 0.44) {
        // Zone 2: Bottom area across full width (bottom margin)
        x = 15 + Math.random() * (width - 30);
        y = Math.max(15, height - 130) + Math.random() * 115;
      } else if (zoneChoice < 0.62) {
        // Zone 3: Center aisle in between branding/hero and auth box
        const aisleMin = Math.max(20, heroRight + 8);
        const aisleMax = Math.min(width - 20, cardLeft - 8);
        const aisleW = Math.max(25, aisleMax - aisleMin);
        x = aisleMin + Math.random() * aisleW;
        y = 30 + Math.random() * (height - 60);
      } else if (zoneChoice < 0.81) {
        // Zone 4: Left side of screen
        const maxL = Math.max(30, heroLeft - 10);
        x = 15 + Math.random() * maxL;
        y = 20 + Math.random() * (height - 40);
      } else {
        // Zone 5: Right side of screen
        const minR = Math.min(width - 30, cardRight + 10);
        const spanR = Math.max(30, width - 15 - minR);
        x = minR + Math.random() * spanR;
        y = 20 + Math.random() * (height - 40);
      }

      if (getContentProximity(x, y, boxes, 14) > 0.25) {
        return {
          x,
          y,
          vx: (Math.random() - 0.5) * 0.20,
          vy: (Math.random() - 0.5) * 0.20,
          text: item.text,
          tag: item.tag,
          type: item.type,
          baseAlpha: 0.40 + Math.random() * 0.22,
          size: item.type === "AST" || item.type === "STAGE" ? 12.5 : 11.5,
          phase: Math.random() * Math.PI * 2,
          driftSpeed: 0.006 + Math.random() * 0.006,
          radius: Math.max(16, (item.text.length * 6.5) / 2)
        };
      }
    }

    return {
      x: 15 + Math.random() * (width - 30),
      y: Math.random() < 0.5 ? 15 + Math.random() * 80 : Math.max(15, height - 90) + Math.random() * 75,
      vx: (Math.random() - 0.5) * 0.20,
      vy: (Math.random() - 0.5) * 0.20,
      text: item.text,
      tag: item.tag,
      type: item.type,
      baseAlpha: 0.40 + Math.random() * 0.22,
      size: 11.5,
      phase: Math.random() * Math.PI * 2,
      driftSpeed: 0.006 + Math.random() * 0.006,
      radius: Math.max(16, (item.text.length * 6.5) / 2)
    };
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    const rect = authView.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    if (width === 0 || height === 0) return;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const boxes = getContentBoxes();
    const targetCount = Math.min(68, Math.max(48, Math.floor((width * height) / 16000)));
    nodes = [];
    for (let i = 0; i < targetCount; i++) {
      const item = COMPILER_DATA[i % COMPILER_DATA.length];
      nodes.push(spawnNode(item, boxes));
    }
  }

  function addTrailParticle(x, y, boxes) {
    if (trailParticles.length > 25) return;
    if (getContentProximity(x, y, boxes, 16) < 0.25) return;
    const item = COMPILER_DATA[Math.floor(Math.random() * COMPILER_DATA.length)];
    trailParticles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vy: -0.5 - Math.random() * 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      text: item.text,
      tag: item.tag,
      alpha: 0.85,
      life: 1,
      decay: 0.020 + Math.random() * 0.010,
      size: 11.5
    });
  }

  window.addEventListener("resize", () => {
    if (!authView.hidden) resize();
  });

  window.addEventListener("mousemove", (e) => {
    if (authView.hidden) {
      mouse.active = false;
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const nx = e.clientX - rect.left;
    const ny = e.clientY - rect.top;

    const dx = nx - mouse.prevX;
    const dy = ny - mouse.prevY;
    const speed = Math.hypot(dx, dy);

    mouse.x = nx;
    mouse.y = ny;
    mouse.active = true;

    const boxes = getContentBoxes();
    if (speed > 6 && Math.random() < 0.45) {
      addTrailParticle(nx, ny, boxes);
    }
    mouse.prevX = nx;
    mouse.prevY = ny;

    startLoop();
  });

  document.addEventListener("mouseleave", () => {
    mouse.active = false;
  });

  function drawRoundedRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function render() {
    if (authView.hidden) {
      animId = null;
      return;
    }

    const boxes = getContentBoxes();

    ctx.clearRect(0, 0, width, height);

    // Smooth proximity of mouse to content (0 inside content, 1 in open background)
    const mouseProx = getContentProximity(mouse.x, mouse.y, boxes, 20);

    // 1. Seamless Ambient Cursor Spotlight & Grid (Zero hard cuts - naturally feathered)
    if (mouse.active && mouseProx > 0.02) {
      const spotRadius = 240;
      const spotGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, spotRadius);
      const sAlpha = mouseProx;
      spotGrad.addColorStop(0, `rgba(9, 9, 11, ${0.12 * sAlpha})`);
      spotGrad.addColorStop(0.35, `rgba(9, 9, 11, ${0.05 * sAlpha})`);
      spotGrad.addColorStop(0.75, `rgba(9, 9, 11, ${0.012 * sAlpha})`);
      spotGrad.addColorStop(1, "rgba(9, 9, 11, 0)");
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, spotRadius, 0, Math.PI * 2);
      ctx.fill();

      // Compiler syntax grid matrix under cursor (softly feathered at edges)
      const gridStep = 32;
      const startX = Math.floor((mouse.x - 180) / gridStep) * gridStep;
      const endX = mouse.x + 180;
      const startY = Math.floor((mouse.y - 180) / gridStep) * gridStep;
      const endY = mouse.y + 180;

      for (let gx = startX; gx <= endX; gx += gridStep) {
        for (let gy = startY; gy <= endY; gy += gridStep) {
          const d = Math.hypot(gx - mouse.x, gy - mouse.y);
          if (d < 170) {
            const ptProx = getContentProximity(gx, gy, boxes, 16);
            if (ptProx > 0.05) {
              const crossAlpha = (1 - d / 170) * 0.35 * sAlpha * ptProx;
              ctx.strokeStyle = `rgba(9, 9, 11, ${crossAlpha})`;
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.moveTo(gx - 3.5, gy);
              ctx.lineTo(gx + 3.5, gy);
              ctx.moveTo(gx, gy - 3.5);
              ctx.lineTo(gx, gy + 3.5);
              ctx.stroke();
            }
          }
        }
      }
    }

    // 2. Inter-node soft collision resolution (elliptical capsule bounds tailored for text tokens)
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const rx = (n1.radius || 22) + (n2.radius || 22);
        const ry = 22;
        const normDist = Math.hypot(dx / rx, dy / ry);

        if (normDist > 0 && normDist < 1.0) {
          const overlap = 1.0 - normDist;
          const nx = (dx / rx) / normDist;
          const ny = (dy / ry) / normDist;

          // Soft position nudge to gracefully avoid overlapping
          const nudgeX = nx * overlap * rx * 0.035;
          const nudgeY = ny * overlap * ry * 0.035;
          n1.x -= nudgeX;
          n1.y -= nudgeY;
          n2.x += nudgeX;
          n2.y += nudgeY;

          // Very slight velocity deflection off each other's path
          const impulse = 0.010 * overlap;
          n1.vx -= nx * impulse;
          n1.vy -= ny * impulse;
          n2.vx += nx * impulse;
          n2.vy += ny * impulse;
        }
      }
    }

    // 3. Update and organize compiler nodes
    const influenceRadius = 230;
    const nearbyNodes = [];

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      // Smooth organic wave drift for calm, fluid floating
      n.phase = (n.phase || 0) + (n.driftSpeed || 0.008);
      const wobbleX = Math.cos(n.phase) * 0.045;
      const wobbleY = Math.sin(n.phase) * 0.045;

      n.x += n.vx + wobbleX;
      n.y += n.vy + wobbleY;

      // Soft velocity damping so collisions settle smoothly without jitter
      const currentSpeed = Math.hypot(n.vx, n.vy);
      if (currentSpeed > 0.22) {
        n.vx *= 0.985;
        n.vy *= 0.985;
      } else if (currentSpeed < 0.06) {
        n.vx += (Math.random() - 0.5) * 0.015;
        n.vy += (Math.random() - 0.5) * 0.015;
      }

      if (n.x < -45) n.x = width + 45;
      else if (n.x > width + 45) n.x = -45;
      if (n.y < -45) n.y = height + 45;
      else if (n.y > height + 45) n.y = -45;

      // Gentle steering away from content boxes so nodes stay naturally in open channels
      for (let j = 0; j < boxes.length; j++) {
        const b = boxes[j];
        const cx = (b.left + b.right) / 2;
        const cy = (b.top + b.bottom) / 2;
        if (n.x >= b.left - 12 && n.x <= b.right + 12 && n.y >= b.top - 12 && n.y <= b.bottom + 12) {
          const angle = Math.atan2(n.y - cy, n.x - cx);
          n.x += Math.cos(angle) * 0.7;
          n.y += Math.sin(angle) * 0.7;
          n.vx += Math.cos(angle) * 0.015;
          n.vy += Math.sin(angle) * 0.015;
        }
      }

      const nProx = getContentProximity(n.x, n.y, boxes, 16);
      if (nProx <= 0.03) continue; // Completely invisible inside content

      let dist = 9999;
      let intensity = 0;
      if (mouse.active && mouseProx > 0.05) {
        dist = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        if (dist < influenceRadius) {
          intensity = (1 - dist / influenceRadius) * mouseProx * nProx;
          const pull = intensity * 12;
          const angle = Math.atan2(mouse.y - n.y, mouse.x - n.x);
          nearbyNodes.push({
            node: n,
            dist,
            intensity,
            prox: nProx,
            drawX: n.x + Math.cos(angle) * pull,
            drawY: n.y + Math.sin(angle) * pull
          });
        }
      }

      // Draw idle node when not actively highlighted
      if (intensity <= 0) {
        const drawAlpha = n.baseAlpha * nProx;
        ctx.font = `500 ${n.size}px "JetBrains Mono", monospace`;
        ctx.fillStyle = `rgba(9, 9, 11, ${drawAlpha})`;
        ctx.fillText(n.text, n.x, n.y);

        // Small solid black joint dot
        ctx.fillStyle = `rgba(9, 9, 11, ${Math.min(1, drawAlpha + 0.1)})`;
        ctx.beginPath();
        ctx.arc(n.x - 6, n.y - 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 3. Draw AST Branch Lines connecting cursor & nearby nodes (Crisp Black, Smoothly Blended)
    if (mouse.active && nearbyNodes.length > 0 && mouseProx > 0.08) {
      // Branch lines from cursor to nodes
      nearbyNodes.forEach(({ node, intensity, prox, drawX, drawY }) => {
        const lineAlpha = (0.35 + intensity * 0.55) * mouseProx * prox;
        ctx.strokeStyle = `rgba(9, 9, 11, ${lineAlpha})`;
        ctx.lineWidth = 1.5 + intensity * 0.7;
        ctx.beginPath();
        ctx.moveTo(mouse.x, mouse.y);
        ctx.lineTo(drawX - 6, drawY - 4);
        ctx.stroke();

        // Node joint dot on cursor connection
        ctx.fillStyle = `rgba(9, 9, 11, ${prox})`;
        ctx.beginPath();
        ctx.arc(drawX - 6, drawY - 4, 3 + intensity * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Midpoint branch label
        if (intensity > 0.35 && prox > 0.6) {
          const midX = (mouse.x + drawX) / 2;
          const midY = (mouse.y + drawY) / 2;
          ctx.font = '600 9px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(9, 9, 11, ${0.7 * intensity * prox})`;
          ctx.fillText("├─ " + (node.type.toLowerCase()), midX + 4, midY - 3);
        }
      });

      // Inter-node AST branch lines
      for (let i = 0; i < nearbyNodes.length; i++) {
        for (let j = i + 1; j < nearbyNodes.length; j++) {
          const p1 = nearbyNodes[i];
          const p2 = nearbyNodes[j];
          const d = Math.hypot(p1.drawX - p2.drawX, p1.drawY - p2.drawY);
          if (d < 130) {
            const lineAlpha = (1 - d / 130) * Math.min(p1.intensity, p2.intensity) * 0.6 * p1.prox * p2.prox;
            if (lineAlpha > 0.02) {
              ctx.strokeStyle = `rgba(9, 9, 11, ${lineAlpha})`;
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.moveTo(p1.drawX - 6, p1.drawY - 4);
              ctx.lineTo(p2.drawX - 6, p2.drawY - 4);
              ctx.stroke();
            }
          }
        }
      }

      // Draw highlighted AST Node Badges
      nearbyNodes.forEach(({ node, intensity, prox, drawX, drawY }) => {
        ctx.font = '700 12px "JetBrains Mono", monospace';
        const textMetrics = ctx.measureText(node.text);
        const tagText = `[${node.tag}]`;
        ctx.font = '600 9.5px "JetBrains Mono", monospace';
        const tagMetrics = ctx.measureText(tagText);

        const padX = 10;
        const totalW = textMetrics.width + tagMetrics.width + padX * 2 + 8;
        const boxH = 25;
        const boxX = drawX - 6;
        const boxY = drawY - 18;
        const badgeAlpha = prox;

        if (intensity > 0.42) {
          // Solid Black Badge with Crisp White Text
          ctx.fillStyle = `rgba(9, 9, 11, ${0.96 * badgeAlpha})`;
          drawRoundedRect(ctx, boxX, boxY, totalW, boxH, 6);
          ctx.fill();

          ctx.strokeStyle = `rgba(9, 9, 11, ${badgeAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Tag
          ctx.font = '600 9.5px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(161, 161, 170, ${badgeAlpha})`;
          ctx.fillText(tagText, boxX + padX, boxY + 16);

          // Text
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(255, 255, 255, ${badgeAlpha})`;
          ctx.fillText(node.text, boxX + padX + tagMetrics.width + 6, boxY + 16.5);
        } else {
          // Crisp White Badge with Solid Black Border
          ctx.fillStyle = `rgba(255, 255, 255, ${0.94 * badgeAlpha})`;
          drawRoundedRect(ctx, boxX, boxY, totalW, boxH, 6);
          ctx.fill();

          ctx.strokeStyle = `rgba(9, 9, 11, ${(0.45 + intensity * 0.55) * badgeAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Tag
          ctx.font = '600 9.5px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(9, 9, 11, ${(0.65 + intensity * 0.3) * badgeAlpha})`;
          ctx.fillText(tagText, boxX + padX, boxY + 16);

          // Text
          ctx.font = '700 12px "JetBrains Mono", monospace';
          ctx.fillStyle = `rgba(9, 9, 11, ${badgeAlpha})`;
          ctx.fillText(node.text, boxX + padX + tagMetrics.width + 6, boxY + 16.5);
        }
      });
    }

    // 4. Draw Compiler Cursor Scanner Reticle (Only when in open background)
    if (mouse.active && mouseProx > 0.15) {
      const reticleAlpha = mouseProx;
      ctx.strokeStyle = `rgba(9, 9, 11, ${0.85 * reticleAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = `rgba(9, 9, 11, ${reticleAlpha})`;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(9, 9, 11, ${0.9 * reticleAlpha})`;
      ctx.lineWidth = 1.5;
      const ticks = [
        [mouse.x - 26, mouse.y, mouse.x - 14, mouse.y],
        [mouse.x + 14, mouse.y, mouse.x + 26, mouse.y],
        [mouse.x, mouse.y - 26, mouse.x, mouse.y - 14],
        [mouse.x, mouse.y + 14, mouse.x, mouse.y + 26],
      ];
      ctx.beginPath();
      ticks.forEach(([x1, y1, x2, y2]) => {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      });
      ctx.stroke();

      ctx.fillStyle = `rgba(9, 9, 11, ${reticleAlpha})`;
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText("PARSE: SCANNING", mouse.x + 28, mouse.y - 8);

      ctx.fillStyle = `rgba(9, 9, 11, ${0.75 * reticleAlpha})`;
      ctx.font = '500 9px "JetBrains Mono", monospace';
      ctx.fillText(`AST_ROOT [X:${Math.round(mouse.x)} Y:${Math.round(mouse.y)}]`, mouse.x + 28, mouse.y + 6);
    }

    // 5. Update and draw floating compiler token trail particles
    for (let i = trailParticles.length - 1; i >= 0; i--) {
      const p = trailParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.life <= 0) {
        trailParticles.splice(i, 1);
        continue;
      }

      ctx.font = `700 ${p.size}px "JetBrains Mono", monospace`;
      ctx.fillStyle = `rgba(9, 9, 11, ${p.alpha * p.life})`;
      ctx.fillText(p.text, p.x, p.y);
    }

    animId = requestAnimationFrame(render);
  }

  function startLoop() {
    if (!animId && !authView.hidden) {
      if (width === 0 || height === 0) resize();
      animId = requestAnimationFrame(render);
    }
  }

  setTimeout(() => {
    if (!authView.hidden) {
      resize();
      startLoop();
    }
  }, 60);

  window._startAuthCompilerCanvas = () => {
    resize();
    startLoop();
  };
})();

$("#logout").addEventListener("click", async () => {
  try { await Api.post("/api/auth/logout"); } catch {}
  leaveApp();
});

$$(".nav-btn").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));

/* ---------- Executive Profile Menu Dropdown (Idea 1) ---------- */
function toggleProfileDropdown(show) {
  const dropdown = $("#profile-dropdown");
  const btn = $("#profile-btn");
  if (!dropdown) return;
  const shouldOpen = show !== undefined ? Boolean(show) : dropdown.hidden;
  dropdown.hidden = !shouldOpen;
  if (btn) btn.setAttribute("aria-expanded", String(shouldOpen));
}

const profileBtn = $("#profile-btn");
const profileDropdown = $("#profile-dropdown");

if (profileBtn && profileDropdown) {
  // Ensure closed by default on initial load
  toggleProfileDropdown(false);

  profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleProfileDropdown();
  });

  // Capture phase listener ensures that clicking ANY button, link, or area outside the dropdown immediately closes it
  window.addEventListener("click", (e) => {
    if (!profileDropdown.hidden && !profileDropdown.contains(e.target) && !profileBtn.contains(e.target)) {
      toggleProfileDropdown(false);
    }
  }, true);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !profileDropdown.hidden) {
      toggleProfileDropdown(false);
      profileBtn.focus();
    }
  });

  profileDropdown.addEventListener("click", (e) => {
    const item = e.target.closest(".profile-dropdown-item");
    if (!item) return;
    toggleProfileDropdown(false);
    if (item.dataset.view) {
      showView(item.dataset.view);
    } else if (item.id === "menu-open-grammar") {
      openGrammarDrawer();
    }
  });
}

/* ---------- Grammar Configuration Slide-Over Sheet / Drawer (Idea 5) ---------- */
const grammarDrawer = $("#grammar-drawer");
const grammarDrawerBackdrop = $("#grammar-drawer-backdrop");
const btnOpenGrammar = $("#btn-open-grammar");
const btnCloseGrammarDrawer = $("#btn-close-grammar-drawer");

function openGrammarDrawer() {
  if (!grammarDrawer) return;
  grammarDrawer.hidden = false;
  if (grammarDrawerBackdrop) grammarDrawerBackdrop.hidden = false;
  requestAnimationFrame(() => {
    grammarDrawer.classList.add("is-open");
  });
  renderGrammar();
}

function closeGrammarDrawer() {
  if (!grammarDrawer) return;
  grammarDrawer.classList.remove("is-open");
  if (grammarDrawerBackdrop) grammarDrawerBackdrop.hidden = true;
  setTimeout(() => {
    if (!grammarDrawer.classList.contains("is-open")) {
      grammarDrawer.hidden = true;
    }
  }, 250);
}

if (btnOpenGrammar) btnOpenGrammar.addEventListener("click", openGrammarDrawer);
if (btnCloseGrammarDrawer) btnCloseGrammarDrawer.addEventListener("click", closeGrammarDrawer);
if (grammarDrawerBackdrop) grammarDrawerBackdrop.addEventListener("click", closeGrammarDrawer);

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && grammarDrawer && !grammarDrawer.hidden && grammarDrawer.classList.contains("is-open")) {
    closeGrammarDrawer();
  }
});

/* ---------- Language Grammar Panel ---------- */
function setGrammar(data) {
  state.grammar = data;
  state.draft = JSON.parse(JSON.stringify(data.grammar));
  renderGrammar();
}

function renderGrammar() {
  const body = $("#grammar-body"), tab = state.gtab;
  $$("[data-gtab]").forEach((t) => t.classList.toggle("is-active", t.dataset.gtab === tab));
  $("#grammar-save").hidden = $("#grammar-reset").hidden = tab === "rules";
  if (tab === "rules") {
    body.innerHTML = `<pre class="code">${esc(state.grammar.bnf)}</pre><p class="muted text-small" style="margin:8px 0 0">Grammar rules use your saved custom keywords and operators. Every statement ends with <code>;</code> and the program terminates with <code>halt;</code>.</p>`;
    return;
  }
  const roles = Object.entries(tab === "keywords" ? state.grammar.keyword_roles : state.grammar.operator_roles);
  const half = Math.ceil(roles.length / 2);
  const tableHtml = (rows) => `<table class="gtable">${rows.map(([role, meaning]) => `<tr>
    <td><label for="g-${role}">${esc(meaning)}</label></td>
    <td><input id="g-${role}" data-role="${role}" value="${esc(state.draft[tab][role])}" spellcheck="false" autocomplete="off"></td>
  </tr>`).join("")}</table>`;
  body.innerHTML = `<div class="grid-2">${tableHtml(roles.slice(0, half))}${tableHtml(roles.slice(half))}</div><div id="grammar-problems"></div>`;
  $$("input[data-role]", body).forEach((i) => i.addEventListener("input", () => {
    state.draft[tab][i.dataset.role] = i.value.trim();
    $("#grammar-msg").textContent = "Unsaved changes";
  }));
}

$$("[data-gtab]").forEach((t) => t.addEventListener("click", () => {
  state.gtab = t.dataset.gtab;
  renderGrammar();
}));

$("#grammar-save").addEventListener("click", async () => {
  try {
    setGrammar(await Api.put("/api/grammar", {
      keywords: state.draft.keywords,
      operators: state.draft.operators
    }));
    $("#grammar-msg").textContent = "Saved. Engines now use updated grammar.";
    toast("Grammar updated successfully");
  } catch (err) {
    const list = (err.problems || [err.message]).map((p) => `<li>${esc(p)}</li>`).join("");
    $("#grammar-problems").innerHTML = `<ul class="problems">${list}</ul>`;
  }
});

$("#grammar-reset").addEventListener("click", async () => {
  try {
    setGrammar(await Api.post("/api/grammar/reset"));
    $("#grammar-msg").textContent = "Reset to default ZynoScript grammar.";
    toast("Grammar reset to default");
  } catch (err) {
    if (err.status === 401) return leaveApp(err.message);
    toast(err.message);
  }
});

/* ---------- Code Editor ---------- */
const code = $("#code"), gutter = $("#gutter");
function updateGutter() {
  const n = code.value.split("\n").length;
  gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
  $("#code-stats").textContent = `${n} line${n > 1 ? "s" : ""} · ${code.value.length} chars`;
}

code.addEventListener("input", updateGutter);
code.addEventListener("scroll", () => (gutter.scrollTop = code.scrollTop));
code.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    runStage("output");
    return;
  }
  if (e.key !== "Tab") return;
  e.preventDefault();
  code.setRangeText("    ", code.selectionStart, code.selectionEnd, "end");
  updateGutter();
});

const sample = $("#sample");
sample.innerHTML = Object.keys(SAMPLES).map((k) => `<option>${esc(k)}</option>`).join("");
enhanceSelect(sample);
sample.addEventListener("change", () => {
  code.value = SAMPLES[sample.value];
  updateGutter();
  resetStates();
  toast(`Loaded "${sample.value}"`);
});
code.value = SAMPLES[sample.value];
updateGutter();

const btnRunEditor = $("#btn-run-editor");
if (btnRunEditor) {
  btnRunEditor.addEventListener("click", () => runStage("output"));
}

function jumpToLine(line) {
  const lines = code.value.split("\n");
  const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
  code.focus();
  code.setSelectionRange(start, start + (lines[line - 1] || "").length);
  const lineHeight = parseFloat(getComputedStyle(code).lineHeight) || 21;
  code.scrollTop = Math.max(0, (line - 4) * lineHeight);
}

/* ---------- Compiler Pipeline Stages ---------- */
function setState(stage, value) {
  const el = $(`.stage[data-stage="${stage}"]`);
  if (el) el.dataset.state = value;
}

function resetStates() {
  STAGES.forEach((s) => setState(s, "idle"));
}

async function runStage(stage) {
  state.selected = stage;
  $$(".stage").forEach((b) => b.classList.toggle("is-selected", b.dataset.stage === stage));
  resetStates();
  const upto = STAGES.indexOf(stage);
  STAGES.forEach((s, i) => {
    if (i <= upto) setState(s, "running");
  });
  $$(".stage, #run-all, #btn-run-editor").forEach((b) => (b.disabled = true));
  const runBtn = $("#btn-run-editor");
  const runAllBtn = $("#run-all");
  if (runBtn) runBtn.classList.add("is-running");
  if (runAllBtn) runAllBtn.classList.add("is-running");
  try {
    const res = await Api.post(`/api/compile/${stage}`, { source: code.value });
    state.lastResults = res;
    STAGES.forEach((s, i) => setState(s, i > upto ? "idle" : res.results[s] ? (res.results[s].ok ? "ok" : "errors") : "blocked"));
    renderOutput(stage, res);
  } catch (err) {
    resetStates();
    if (err.status === 401) return leaveApp(err.message);
    $("#output").innerHTML = `<p class="form-error">${esc(err.message)}</p>`;
  } finally {
    $$(".stage, #run-all, #btn-run-editor").forEach((b) => {
      b.disabled = false;
      b.classList.remove("is-running");
    });
  }
}

$$(".stage").forEach((b) => b.addEventListener("click", () => runStage(b.dataset.stage)));
$("#run-all").addEventListener("click", () => runStage("output"));

/* ---------- Output Inspector Rendering ---------- */
const errorList = (errs) => !errs.length ? "" : `<ul class="errors">${errs.map((e, i) =>
  `<li style="--i:${i}"><button type="button" data-line="${e.line}"><span class="where">Line ${e.line}${e.col ? ":" + e.col : ""}${e.rule ? " · Rule " + e.rule : ""}</span><span>${esc(e.message)}</span></button></li>`).join("")}</ul>`;

const okBanner = (text) => `<div class="success">${icon("check")}<span>${text}</span></div>`;

const table = (heads, rows, mono = []) => `<div class="tbl-wrap"><table class="tbl"><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
  rows.map((r) => `<tr>${r.map((c, i) => `<td class="${mono.includes(i) ? "m" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

const RENDER = {
  lexical: (r) => {
    const tab = state.lexTab || "tokens";
    const subtabs = `<div class="subtabs-bar">
      <button class="subtab-btn ${tab === 'tokens' ? 'is-active' : ''}" data-lextab="tokens">Tokens (${r.count})</button>
      <button class="subtab-btn ${tab === 'identifiers' ? 'is-active' : ''}" data-lextab="identifiers">Identifiers (${r.identifiers.length})</button>
      <button class="subtab-btn ${tab === 'lines' ? 'is-active' : ''}" data-lextab="lines">By Line</button>
      <button class="subtab-btn ${tab === 'categories' ? 'is-active' : ''}" data-lextab="categories">Categories (${r.categories.length})</button>
    </div>`;

    let content = "";
    if (tab === "tokens") {
      content = r.tokens.length
        ? table(["Line", "Col", "Lexeme", "Category"], r.tokens.map((t) => [t.line, t.col, t.lexeme, t.category]), [2])
        : `<p class="empty text-muted">No tokens generated.</p>`;
    } else if (tab === "identifiers") {
      content = r.identifiers.length
        ? table(["Identifier", "First Line", "Count"], r.identifiers.map((i) => [i.name, i.first_line, i.count]), [0])
        : `<p class="empty text-muted">No identifiers found in source.</p>`;
    } else if (tab === "lines") {
      content = table(["Line", "Source Text", "Tokens"], r.lines.map((l) => [l.line, l.text || "(empty)", l.tokens.map((t) => t.lexeme).join("  ") || "-"]), [1]);
    } else if (tab === "categories") {
      content = table(["Category", "Count", "Lexemes Used"], r.categories.map((c) => [c.category, c.count, c.lexemes.join("  ")]), [2]);
    }

    return (r.ok ? okBanner(`${r.count} tokens identified · No lexical errors`) : `<h3>${r.errors.length} Lexical Error(s)</h3>`) +
      errorList(r.errors) + subtabs + content;
  },

  syntax: (r) => r.ok
    ? okBanner("Syntax verified · Parse tree generated successfully") + `<h3>Abstract Syntax Tree (AST)</h3><pre class="tree">${esc(r.tree)}</pre>`
    : `<h3>Syntax Error</h3>` + errorList(r.errors),

  semantic: (r) => {
    return (r.ok ? okBanner("Semantic check passed · All type and scope rules validated") : `<h3>${r.errors.length} Semantic Error(s)</h3>`) +
      errorList(r.errors) +
      `<h3>Symbol Table</h3>` + (r.symbols.length ? table(["Variable", "Type", "Declared Line"], r.symbols.map((s) => [s.name, s.type, s.line]), [0, 1]) : `<p class="empty text-muted">No variable declarations found.</p>`);
  },

  output: (r) => {
    return (r.ok ? okBanner(`Execution finished in ${r.steps} step(s)`) : `<h3>Runtime Error</h3>` + errorList(r.errors)) +
      `<h3>Program Console (Printed Lines)</h3><pre class="console">${esc(r.output.length ? r.output.join("\n") : "(no output produced)")}</pre>` +
      `<h3>Final Variable State</h3>` + (r.variables.length ? table(["Variable", "Value"], r.variables.map((v) => [v.name, v.value]), [1]) : `<p class="empty text-muted">No active variables.</p>`);
  },

  icg: (r) => {
    const tab = state.icgTab || "tac";
    const subtabs = `<div class="subtabs-bar">
      <button class="subtab-btn ${tab === 'tac' ? 'is-active' : ''}" data-icgtab="tac">Three-Address Code (TAC)</button>
      <button class="subtab-btn ${tab === 'quads' ? 'is-active' : ''}" data-icgtab="quads">Quadruples Table (${r.quads.length})</button>
    </div>`;

    const content = tab === "tac"
      ? `<pre class="code">${esc(r.tac.join("\n"))}</pre>`
      : table(["#", "Operator", "Arg 1", "Arg 2", "Result"], r.quads.map((q, i) => [i, q.op, q.arg1, q.arg2, q.result]), [1, 2, 3, 4]);

    return okBanner("Intermediate code generated") + subtabs + content;
  },
};

function renderOutput(stage, res) {
  const shown = res.results[stage] ? stage : res.blocked_by;
  const r = res.results[shown];
  $("#out-title").textContent = STAGE_TITLE[shown];
  const badge = $("#out-status");
  badge.hidden = false;
  badge.className = "badge " + (r.ok ? "ok" : "bad");
  badge.textContent = r.ok ? "Passed" : `${r.errors.length} error${r.errors.length > 1 ? "s" : ""}`;
  const notice = shown !== stage ? `<div class="notice"><span>${STAGE_TITLE[stage]} blocked by errors in ${STAGE_TITLE[shown]}. Resolve them to continue.</span></div>` : "";
  const outputEl = $("#output");
  outputEl.innerHTML = `<div class="out-anim">${notice}${RENDER[shown](r)}</div>`;
  if (typeof hydrateIcons === "function") hydrateIcons(outputEl);

  // Jump to code line on error click
  $$("button[data-line]", outputEl).forEach((b) => b.addEventListener("click", () => jumpToLine(+b.dataset.line)));

  // Sub-tabs for lexical
  $$("[data-lextab]", outputEl).forEach((b) => b.addEventListener("click", () => {
    state.lexTab = b.dataset.lextab;
    renderOutput(stage, res);
  }));

  // Sub-tabs for ICG
  $$("[data-icgtab]", outputEl).forEach((b) => b.addEventListener("click", () => {
    state.icgTab = b.dataset.icgtab;
    renderOutput(stage, res);
  }));

  // Contextual controls: Show Copy and Clear only when results exist (Idea 4)
  if (btnCopyOutput) btnCopyOutput.hidden = false;
  if (btnClearOutput) btnClearOutput.hidden = false;
}

// Copy output tool
const btnCopyOutput = $("#btn-copy-output");
if (btnCopyOutput) {
  btnCopyOutput.addEventListener("click", () => {
    const text = $("#output").innerText;
    if (!text || text.includes("Pick a compiler stage")) return toast("No output to copy");
    navigator.clipboard.writeText(text).then(() => toast("Output copied to clipboard"));
  });
}

// Clear output tool
const btnClearOutput = $("#btn-clear-output");
if (btnClearOutput) {
  btnClearOutput.addEventListener("click", () => {
    resetStates();
    $("#out-title").textContent = "Compiler Output";
    $("#out-status").hidden = true;
    btnClearOutput.hidden = true;
    if (btnCopyOutput) btnCopyOutput.hidden = true;
    $("#output").innerHTML = `<div class="empty-state out-anim">
      <div class="empty-glyph">${icon("braces")}</div>
      <p>Pick a compiler stage above or hit <b>Run All</b> to analyze and run your code.</p>
    </div>`;
  });
}

/* ---------- Activity Stream (Feed-Style Audit Trail - Idea 6) ---------- */
$("#log-filter").innerHTML += ACTIONS.map((a) => `<option value="${a}">${a.replace(/_/g, " ")}</option>`).join("");
enhanceSelect($("#log-filter"));
enhanceSelect($("#log-user"));

function timeAgo(dateInput) {
  if (!dateInput) return "";
  // The server stores UTC as "YYYY-MM-DD HH:MM:SS" with no zone; parse it as UTC, not local time.
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(dateInput) ? dateInput : dateInput.replace(" ", "T") + "Z";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return dateInput;
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString();
}

function formatActionPhrase(log) {
  const user = `<strong>${esc(log.username)}</strong>`;
  const act = log.action;
  const lines = log.program_size !== null && log.program_size !== undefined ? ` on <strong>${log.program_size} line${log.program_size === 1 ? '' : 's'}</strong>` : "";

  let actionText = "";
  if (act === "login") actionText = "signed in";
  else if (act === "logout") actionText = "signed out";
  else if (act === "register") actionText = "created an account";
  else if (act === "run_lexical") actionText = `ran <span class="feed-action-badge">Lexical Analysis</span>${lines}`;
  else if (act === "run_syntax") actionText = `ran <span class="feed-action-badge">Syntax Analysis</span>${lines}`;
  else if (act === "run_semantic") actionText = `ran <span class="feed-action-badge">Semantic Analysis</span>${lines}`;
  else if (act === "run_icg") actionText = `ran <span class="feed-action-badge">ICG</span>${lines}`;
  else if (act === "run_output") actionText = `ran <span class="feed-action-badge">Output Engine</span>${lines}`;
  else if (act === "grammar_update") actionText = "updated language grammar configuration";
  else if (act === "grammar_reset") actionText = "reset language grammar to default";
  else if (act.startsWith("admin_")) actionText = `performed admin action: <span class="feed-action-badge">${esc(act.replace("admin_", "").replace(/_/g, " "))}</span>`;
  else actionText = `performed <span class="feed-action-badge">${esc(act.replace(/_/g, " "))}</span>${lines}`;

  return `${user} ${actionText}`;
}

async function loadLogs() {
  const action = $("#log-filter").value, who = $("#log-user").value;
  const status = $("#log-status") ? $("#log-status").value : "";
  try {
    let url = "/api/logs?limit=300";
    if (action) url += "&action=" + encodeURIComponent(action);
    if (who) url += "&username=" + encodeURIComponent(who);
    if (status) url += "&status=" + encodeURIComponent(status);
    const res = await Api.get(url);
    $("#log-scope").textContent = res.scope === "everyone"
      ? (who ? `Showing telemetry filtered to user: ${who}` : "Showing telemetry across all users")
      : "Showing your account history";
    
    if (!res.logs || !res.logs.length) {
      $("#log-body").innerHTML = `<div class="empty-state" style="padding:48px 20px">
        <div class="empty-glyph">${icon("activity")}</div>
        <p>No activity recorded yet.</p>
      </div>`;
      return;
    }

    const itemsHtml = res.logs.map((l, idx) => {
      const isOk = l.status === "ok";
      const shortHash = l.program_hash ? l.program_hash.slice(0, 7) : "";
      const time = timeAgo(l.created_at);

      return `
        <div class="feed-item" style="--i:${Math.min(idx, 14)}" tabindex="0" role="button" aria-expanded="false">
          <div class="feed-left">
            <span class="feed-dot ${isOk ? 'ok' : 'error'}" title="${isOk ? 'Success' : 'Error'}"></span>
            <div class="feed-content">
              <div class="feed-summary">${formatActionPhrase(l)}</div>
              <div class="feed-time" title="${esc(l.created_at)}">${time} · ${esc(l.created_at)}</div>
            </div>
          </div>
          <div class="feed-right">
            ${shortHash ? `<span class="feed-hash" title="Program hash: ${esc(l.program_hash)}">#${shortHash}</span>` : ''}
            <span class="feed-chevron" aria-hidden="true">${icon("chevron")}</span>
          </div>
          <div class="feed-details" hidden>
            <div class="feed-detail-row">
              <span class="feed-detail-label">Full Timestamp:</span>
              <span class="feed-detail-value">${esc(l.created_at)}</span>
            </div>
            <div class="feed-detail-row">
              <span class="feed-detail-label">Status:</span>
              <span class="feed-detail-value ${isOk ? 'status-ok' : 'status-error'}">${esc(l.status.toUpperCase())}</span>
            </div>
            ${l.program_hash ? `
            <div class="feed-detail-row">
              <span class="feed-detail-label">Program Hash:</span>
              <span class="feed-detail-value">${esc(l.program_hash)}</span>
            </div>
            ` : ''}
            ${l.detail ? `
            <div class="feed-detail-row">
              <span class="feed-detail-label">Details:</span>
              <span class="feed-detail-value">${esc(l.detail)}</span>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");

    $("#log-body").innerHTML = `<div class="activity-feed">${itemsHtml}</div>`;

    // Click to expand/collapse details
    $$(".feed-item", $("#log-body")).forEach((item) => {
      const toggle = () => {
        const details = $(".feed-details", item);
        if (!details) return;
        const expanded = item.classList.toggle("is-expanded");
        details.hidden = !expanded;
        item.setAttribute("aria-expanded", String(expanded));
      };

      item.addEventListener("click", toggle);
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });
    });

  } catch (err) {
    if (err.status === 401) leaveApp(err.message);
  }
}

$("#log-filter").addEventListener("change", loadLogs);
$("#log-user").addEventListener("change", loadLogs);
if ($("#log-status")) $("#log-status").addEventListener("change", loadLogs);
$("#log-refresh").addEventListener("click", loadLogs);

const btnLogExport = $("#log-export-btn");
if (btnLogExport) {
  btnLogExport.addEventListener("click", async () => {
    try {
      const action = $("#log-filter").value, who = $("#log-user").value, status = $("#log-status") ? $("#log-status").value : "";
      let url = "/api/logs?limit=1000";
      if (action) url += "&action=" + encodeURIComponent(action);
      if (who) url += "&username=" + encodeURIComponent(who);
      if (status) url += "&status=" + encodeURIComponent(status);
      const res = await Api.get(url);
      const dataStr = JSON.stringify(res.logs || [], null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `zynoscript_telemetry_${who || "all"}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Exported activity telemetry as JSON");
    } catch (err) {
      toast("Export failed: " + err.message);
    }
  });
}


/* ---------- Language Guide ---------- */
function renderGuide() {
  if (!state.grammar) return;
  const g = state.grammar.grammar, kr = state.grammar.keyword_roles, or = state.grammar.operator_roles;
  const TYPES = ["INT", "FLOAT", "STRING", "BOOL", "CHAR"];
  const NORMAL_T = { INT: "int", FLOAT: "float", STRING: "str", BOOL: "bool", CHAR: "char" };
  const NORMAL_OP = { ASSIGN: "=", ADD: "+", SUB: "-", MUL: "*", DIV: "/", GT: ">", LT: "<", EQ: "==", NE: "!=", AND: "&&", OR: "||", NOT: "!" };
  const kw = Object.keys(kr).filter((r) => !TYPES.includes(r));
  $("#guide-keywords").innerHTML = table(["Purpose", "ZynoScript Keyword"], kw.map((r) => [kr[r], g.keywords[r]]), [1]);
  $("#guide-operators").innerHTML = table(["Purpose", "Standard Operator", "ZynoScript Operator"], Object.keys(or).map((r) => [or[r], NORMAL_OP[r] || "", g.operators[r]]), [1, 2]);
  $("#guide-types").innerHTML = table(["Type", "Standard Equivalent", "ZynoScript Keyword"], TYPES.map((r) => [kr[r].replace("Type: ", ""), NORMAL_T[r], g.keywords[r]]), [1, 2]);
  $("#guide-bnf").textContent = state.grammar.bnf;
  const k = g.keywords, o = g.operators;
  $("#gd-halt").textContent = `${k.HALT};`;
  $("#gd-decl1").textContent = `${k.LET} ${k.INT} a ${o.ASSIGN} 5;`;
  $("#gd-decl2").textContent = `${k.LET} x ${o.ASSIGN} 5;`;
}

$("#guide-try").addEventListener("click", () => {
  sample.value = "Lab handout example";
  code.value = SAMPLES[sample.value];
  updateGutter();
  resetStates();
  showView("workbench");
  toast("Loaded handout example into editor");
});

/* ---------- Admin: User Management ---------- */
function ask({ title, text, password = false, confirm = "Confirm", danger = false }) {
  const d = $("#dlg"), input = $("#dlg-input");
  $("#dlg-title").textContent = title;
  $("#dlg-text").textContent = text;
  $("#dlg-field").hidden = !password;
  input.required = password;
  input.value = "";
  const ok = $("#dlg-ok");
  ok.textContent = confirm;
  ok.className = "btn " + (danger ? "danger" : "primary");
  d.showModal();
  return new Promise((resolve) => d.addEventListener("close", () => resolve(d.returnValue === "ok" ? (password ? input.value : true) : null), { once: true }));
}

async function fillUserFilter() {
  try {
    const res = await Api.get("/api/admin/users");
    if (!res || !res.users) return;
    const current = $("#log-user").value;
    const opts = `<option value="">All users</option>` + res.users.map((u) => `<option value="${esc(u.username)}">${esc(u.username)}</option>`).join("");
    $("#log-user").innerHTML = opts;
    if (current) $("#log-user").value = current;
    if ($("#log-user")._enhanced) $("#log-user")._enhanced.rebuild();
  } catch (err) {
    console.warn("Could not load users for filter:", err);
  }
}

let adminUsersCache = [];

async function loadTelemetry() {
  try {
    const res = await Api.get("/api/admin/telemetry");
    const t = res.telemetry;
    if (!t) return;
    if ($("#stat-total-users")) $("#stat-total-users").textContent = t.total_users;
    if ($("#stat-users-meta")) $("#stat-users-meta").textContent = `${t.admin_users} admin · ${t.regular_users} standard`;
    if ($("#stat-total-runs")) $("#stat-total-runs").textContent = t.total_runs;
    if ($("#stat-runs-meta")) $("#stat-runs-meta").textContent = `${t.success_rate_pct}% pass rate (${t.total_success} ok / ${t.total_errors} err)`;
    if ($("#stat-active-sessions")) $("#stat-active-sessions").textContent = t.active_sessions;
    if ($("#stat-db-type")) $("#stat-db-type").textContent = (t.db_backend || "").split(" ")[0] || "Active";
    if ($("#stat-db-meta")) $("#stat-db-meta").innerHTML = `<span class="live-dot ok"></span> ${esc(t.db_backend || "Connected")}`;

    const stageEl = $("#admin-stage-stats");
    if (stageEl) {
      const stageLabels = { lexical: "Lexical", syntax: "Syntax", semantic: "Semantic", icg: "ICG", output: "Output" };
      const pills = Object.entries(stageLabels).map(([key, label], idx) => {
        const cnt = (t.stages && t.stages[key]) || 0;
        return `<div class="stage-stat-pill">
          <span class="stage-stat-name"><span class="stage-num">0${idx + 1}</span> ${label}</span>
          <span class="stage-stat-count">${cnt} runs</span>
        </div>`;
      }).join("");
      stageEl.innerHTML = pills;
    }
  } catch (err) {
    console.warn("Telemetry fetch error:", err);
  }
}

function renderUsersTable() {
  const query = ($("#admin-user-search") ? $("#admin-user-search").value : "").trim().toLowerCase();
  const roleFilter = $("#admin-role-filter") ? $("#admin-role-filter").value : "";

  let filtered = adminUsersCache.filter((u) => {
    if (query && !u.username.toLowerCase().includes(query)) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  if (!filtered.length) {
    $("#users-body").innerHTML = `<div class="empty-state" style="padding:32px 16px">
      <div class="empty-glyph">${icon("users")}</div>
      <p>${adminUsersCache.length === 0 ? "No registered users found." : "No users match your search."}</p>
    </div>`;
    return;
  }

  const rows = filtered.map((u) => {
    const me = u.id === state.user.id;
    const customGrammarBadge = u.has_custom_grammar
      ? `<span class="badge ok" title="User has customized keywords or operators">Custom</span>`
      : `<span class="badge" title="User uses default grammar">Default</span>`;

    return `<tr>
      <td><strong>${esc(u.username)}</strong>${me ? ' <span class="muted text-small">(you)</span>' : ""}</td>
      <td><span class="badge ${u.role === 'admin' ? 'ok' : ''}">${esc(u.role)}</span></td>
      <td class="mono text-muted text-small">${esc(u.created_at)}</td>
      <td class="mono"><strong>${u.runs}</strong></td>
      <td class="text-small">${esc(u.last_active || "never")}</td>
      <td>${customGrammarBadge}</td>
      <td>
        <div class="cell-actions">
          <button class="btn small ghost" data-act="view-logs" data-name="${esc(u.username)}" title="View ${esc(u.username)}'s activity stream">View Logs</button>
          <button class="btn small ghost" data-act="inspect-grammar" data-id="${u.id}" data-name="${esc(u.username)}" title="Inspect language grammar">Grammar</button>
          ${u.has_custom_grammar ? `<button class="btn small ghost" data-act="reset-grammar" data-id="${u.id}" data-name="${esc(u.username)}" title="Reset user grammar to default">Reset Grammar</button>` : ""}
          <button class="btn small" data-act="password" data-id="${u.id}" data-name="${esc(u.username)}">Reset Pwd</button>
          ${me ? "" : `
            <button class="btn small" data-act="role" data-id="${u.id}" data-name="${esc(u.username)}" data-role="${u.role === "admin" ? "user" : "admin"}">Make ${u.role === "admin" ? "user" : "admin"}</button>
            <button class="btn small danger" data-act="delete" data-id="${u.id}" data-name="${esc(u.username)}">Delete</button>
          `}
        </div>
      </td>
    </tr>`;
  }).join("");

  $("#users-body").innerHTML = `<table class="tbl"><thead><tr><th>User</th><th>Role</th><th>Registered (UTC)</th><th>Runs</th><th>Last Active</th><th>Grammar</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function loadUsers() {
  try {
    const { users } = await Api.get("/api/admin/users");
    adminUsersCache = users || [];
    renderUsersTable();
  } catch (err) {
    if (err.status === 401) leaveApp(err.message);
    else $("#users-body").innerHTML = `<p class="form-error" style="padding:16px">${esc(err.message)}</p>`;
  }
}

async function loadAdminDashboard() {
  await Promise.all([loadTelemetry(), loadUsers()]);
}

$("#users-body").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const { act, id, name, role } = b.dataset;
  try {
    if (act === "view-logs") {
      showView("activity");
      $("#log-user").value = name;
      if ($("#log-user")._enhanced) $("#log-user")._enhanced.syncValue();
      loadLogs();
      toast(`Showing activity for ${name}`);
      return;
    } else if (act === "inspect-grammar") {
      const res = await Api.get(`/api/admin/users/${id}/grammar`);
      const dlg = $("#dlg-grammar");
      if (!dlg) return;
      $("#dlg-grammar-title").textContent = `${name}'s Language Grammar`;
      $("#dlg-grammar-sub").textContent = res.has_custom ? "Customized language keywords & operators" : "Using standard default ZynoScript grammar";
      const g = res.grammar;
      const kr = (state.grammar && state.grammar.keyword_roles) || {};
      const or = (state.grammar && state.grammar.operator_roles) || {};
      const kwRows = Object.entries(g.keywords || {}).map(([r, w]) => `<tr><td class="mono">${esc(r)}</td><td>${esc(kr[r] || "")}</td><td class="mono"><strong>${esc(w)}</strong></td></tr>`).join("");
      const opRows = Object.entries(g.operators || {}).map(([r, w]) => `<tr><td class="mono">${esc(r)}</td><td>${esc(or[r] || "")}</td><td class="mono"><strong>${esc(w)}</strong></td></tr>`).join("");
      $("#dlg-grammar-content").innerHTML = `
        <div class="card-panel">
          <header class="card-header"><h4>Keywords</h4></header>
          <table class="tbl"><thead><tr><th>Role</th><th>Description</th><th>Token</th></tr></thead><tbody>${kwRows}</tbody></table>
        </div>
        <div class="card-panel">
          <header class="card-header"><h4>Operators</h4></header>
          <table class="tbl"><thead><tr><th>Role</th><th>Description</th><th>Token</th></tr></thead><tbody>${opRows}</tbody></table>
        </div>
      `;
      dlg.showModal();
      return;
    } else if (act === "reset-grammar") {
      if (!(await ask({ title: `Reset grammar for ${name}?`, text: `Revert ${name}'s keywords and operators back to default ZynoScript specification.`, confirm: "Reset Grammar" }))) return;
      await Api.post(`/api/admin/users/${id}/grammar/reset`);
      toast(`Grammar reset to default for ${name}`);
      loadAdminDashboard();
      return;
    } else if (act === "password") {
      const pw = await ask({ title: "Reset Password", text: `Set a new password for ${name}. They will be logged out on all devices.`, password: true, confirm: "Reset Password" });
      if (pw === null) return;
      await Api.post(`/api/admin/users/${id}/password`, { password: pw });
      toast(`Password updated for ${name}`);
    } else if (act === "role") {
      if (!(await ask({ title: `Change role for ${name}?`, text: `Set ${name}'s role to ${role}.`, confirm: "Update Role" }))) return;
      await Api.post(`/api/admin/users/${id}/role`, { role });
      toast(`${name} is now ${role}`);
    } else if (act === "delete") {
      if (!(await ask({ title: `Delete user ${name}?`, text: "Their account and custom grammar will be permanently removed.", confirm: "Delete", danger: true }))) return;
      await Api.call("DELETE", `/api/admin/users/${id}`);
      toast(`${name} deleted`);
      fillUserFilter();
    }
    loadAdminDashboard();
  } catch (err) {
    toast(err.message);
  }
});

$("#users-refresh").addEventListener("click", loadAdminDashboard);

if ($("#admin-user-search")) $("#admin-user-search").addEventListener("input", renderUsersTable);
if ($("#admin-role-filter")) $("#admin-role-filter").addEventListener("change", renderUsersTable);

async function handlePrune(days, label) {
  if (!(await ask({ title: `Prune telemetry logs (${label})?`, text: `This will permanently delete activity logs ${days === 0 ? 'completely' : 'older than ' + days + ' days'}. Registered user accounts are retained.`, confirm: "Prune Logs", danger: true }))) return;
  try {
    const res = await Api.post("/api/admin/logs/prune", { days });
    toast(res.detail || "Logs pruned successfully");
    loadAdminDashboard();
    loadLogs();
  } catch (err) {
    toast(err.message);
  }
}

if ($("#btn-prune-7d")) $("#btn-prune-7d").addEventListener("click", () => handlePrune(7, "> 7 days"));
if ($("#btn-prune-30d")) $("#btn-prune-30d").addEventListener("click", () => handlePrune(30, "> 30 days"));
if ($("#btn-prune-all")) $("#btn-prune-all").addEventListener("click", () => handlePrune(0, "ALL logs"));


/* ---------- Application Start ---------- */
(async function start() {
  resetStates();
  enhanceSelect($("#sample"));
  enhanceSelect($("#log-filter"));
  enhanceSelect($("#log-user"));
  const savedUser = localStorage.getItem("zs_user");
  if (savedUser) {
    $("#auth-user").value = savedUser;
    $("#auth-remember").checked = true;
  }
  if (!Api.token) return showView("auth");
  try {
    const me = await Api.get("/api/auth/me");
    await enterApp(me);
  } catch {
    leaveApp();
  }
})();

/* =========================================
   COMMAND PALETTE (Ctrl + K / Cmd + K)
   ========================================= */
const cmdPalette = $("#cmd-palette");
const cmdInput = $("#cmd-input");
const cmdList = $("#cmd-list");
const cmdTrigger = $("#cmd-trigger");

let cmdActiveIndex = 0;
let currentCmds = [];

function getCommands() {
  const isAdmin = state.user && state.user.role === "admin";
  return [
    // Execution & Pipeline
    {
      id: "run-all",
      group: "Compiler Pipeline",
      name: "Run All Compiler Stages",
      desc: "Execute lexical, syntax, semantic, ICG, and program output",
      icon: "play",
      shortcut: "Ctrl+Enter",
      action: () => runStage("output"),
    },
    {
      id: "run-lexical",
      group: "Compiler Pipeline",
      name: "Run Lexical Analysis",
      desc: "Tokenize source text into tokens, identifiers, and categories",
      icon: "01",
      action: () => runStage("lexical"),
    },
    {
      id: "run-syntax",
      group: "Compiler Pipeline",
      name: "Run Syntax Analysis",
      desc: "Parse tokens into Abstract Syntax Tree (AST)",
      icon: "02",
      action: () => runStage("syntax"),
    },
    {
      id: "run-semantic",
      group: "Compiler Pipeline",
      name: "Run Semantic Analysis",
      desc: "Build symbol table and validate scope and type rules",
      icon: "03",
      action: () => runStage("semantic"),
    },
    {
      id: "run-icg",
      group: "Compiler Pipeline",
      name: "Generate Intermediate Code",
      desc: "Generate three-address code (TAC) and quadruples",
      icon: "04",
      action: () => runStage("icg"),
    },
    {
      id: "run-output",
      group: "Compiler Pipeline",
      name: "Execute Program Output",
      desc: "Run virtual machine interpreter to print output and variables",
      icon: "05",
      action: () => runStage("output"),
    },

    // Code Samples & Handout
    {
      id: "sample-handout",
      group: "Sample Programs",
      name: "Load Handout Example (If/Else)",
      desc: "Load the official lab assignment example from the handout",
      icon: "file",
      action: () => {
        sample.value = "Lab handout example";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Lab handout example"');
      },
    },
    {
      id: "sample-working",
      group: "Sample Programs",
      name: "Load Working Program",
      desc: "A complete ZynoScript program demonstrating all language types",
      icon: "file",
      action: () => {
        sample.value = "Working program";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Working program"');
      },
    },
    {
      id: "sample-loop",
      group: "Sample Programs",
      name: "Load Loop with If/Else Sample",
      desc: "Program calculating odd and even numbers in a loop",
      icon: "loop",
      action: () => {
        sample.value = "Loop with if/else inside";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Loop with if/else"');
      },
    },
    {
      id: "sample-factorial",
      group: "Sample Programs",
      name: "Load Factorial Calculation Sample",
      desc: "Calculates 5! (factorial of 5) using an iterative loop",
      icon: "file",
      action: () => {
        sample.value = "Factorial calculation";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Factorial calculation"');
      },
    },
    {
      id: "sample-fibonacci",
      group: "Sample Programs",
      name: "Load Fibonacci Sequence Sample",
      desc: "Generates the Fibonacci series using a while loop",
      icon: "file",
      action: () => {
        sample.value = "Fibonacci sequence";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Fibonacci sequence"');
      },
    },
    {
      id: "sample-max3",
      group: "Sample Programs",
      name: "Load Find Maximum of 3 Numbers Sample",
      desc: "Finds the largest value among three variables using conditionals",
      icon: "file",
      action: () => {
        sample.value = "Find maximum of 3";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Find maximum of 3"');
      },
    },
    {
      id: "sample-temp",
      group: "Sample Programs",
      name: "Load Temperature Converter Sample",
      desc: "Converts Celsius to Fahrenheit with float arithmetic",
      icon: "file",
      action: () => {
        sample.value = "Temperature converter";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Temperature converter"');
      },
    },
    {
      id: "sample-semantic-errors",
      group: "Sample Programs",
      name: "Load Semantic Errors Test",
      desc: "Sample triggering semantic rules 1, 2, 3, 4, 5, 6, 7",
      icon: "alert",
      action: () => {
        sample.value = "Semantic errors";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded "Semantic errors" test');
      },
    },
    {
      id: "sample-syntax-errors",
      group: "Sample Programs",
      name: "Load Missing Semicolon Test",
      desc: "Test reporting syntax errors on line 2",
      icon: "alert",
      action: () => {
        sample.value = "Syntax error: missing ;";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded syntax test');
      },
    },
    {
      id: "sample-lexical-errors",
      group: "Sample Programs",
      name: "Load Lexical Errors Test",
      desc: "Test reporting invalid characters and unclosed strings",
      icon: "alert",
      action: () => {
        sample.value = "Lexical errors";
        code.value = SAMPLES[sample.value];
        updateGutter();
        resetStates();
        showView("workbench");
        toast('Loaded lexical test');
      },
    },

    // Navigation & Workspace
    {
      id: "nav-workbench",
      group: "Navigation",
      name: "Go to Workbench Studio",
      desc: "Main compiler IDE and output inspector",
      icon: "bolt",
      action: () => showView("workbench"),
    },
    {
      id: "nav-grammar",
      group: "Navigation",
      name: "Open Grammar Settings (Slide-Over)",
      desc: "Customize keywords, operators, or view BNF production rules in side sheet",
      icon: "sliders",
      action: () => {
        showView("workbench");
        openGrammarDrawer();
      },
    },
    {
      id: "nav-editor",
      group: "Navigation",
      name: "Source Code Editor",
      desc: "Focus the main ZynoScript code editor",
      icon: "code",
      action: () => {
        showView("workbench");
        code.focus();
      },
    },
    {
      id: "nav-guide",
      group: "Navigation",
      name: "View Language Specification Guide",
      desc: "Documentation of keywords, operators, types, and BNF rules",
      icon: "book",
      action: () => showView("guide"),
    },
    {
      id: "nav-activity",
      group: "Navigation",
      name: "View Activity Log",
      desc: "Audit trail of actions, line counts, and program hashes",
      icon: "activity",
      action: () => showView("activity"),
    },
    ...(isAdmin ? [{
      id: "nav-admin",
      group: "Navigation",
      name: "Admin User Management",
      desc: "Manage users, reset passwords, and audit telemetry",
      icon: "shield",
      action: () => showView("admin"),
    }] : []),

    // Tools & Utilities
    {
      id: "tool-copy",
      group: "Tools",
      name: "Copy Compiler Output",
      desc: "Copy active stage's output text to clipboard",
      icon: "copy",
      action: () => {
        if (btnCopyOutput) btnCopyOutput.click();
      },
    },
    {
      id: "tool-clear",
      group: "Tools",
      name: "Clear Output Inspector",
      desc: "Reset output panel to empty state",
      icon: "trash",
      action: () => {
        if (btnClearOutput) btnClearOutput.click();
      },
    },
    {
      id: "tool-reset-grammar",
      group: "Tools",
      name: "Reset Grammar to Default",
      desc: "Revert all keywords and operators back to original ZynoScript",
      icon: "reset",
      action: () => {
        const btn = $("#grammar-reset");
        if (btn) btn.click();
      },
    },
    {
      id: "auth-logout",
      group: "Account",
      name: "Sign Out",
      desc: "End active session and return to sign-in screen",
      icon: "logout",
      action: () => {
        const btn = $("#logout");
        if (btn) btn.click();
      },
    },
  ];
}

function openCmdPalette() {
  if (!state.user || !cmdPalette) return;
  cmdPalette.showModal();
  cmdInput.value = "";
  cmdActiveIndex = 0;
  filterAndRenderCommands("");
  setTimeout(() => cmdInput.focus(), 50);
}

function closeCmdPalette() {
  if (!cmdPalette || !cmdPalette.open) return;
  cmdPalette.close();
}

function filterAndRenderCommands(query) {
  const q = query.trim().toLowerCase();
  const all = getCommands();
  currentCmds = q
    ? all.filter(c => c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.group.toLowerCase().includes(q))
    : all;

  if (cmdActiveIndex >= currentCmds.length) cmdActiveIndex = 0;

  if (!currentCmds.length) {
    cmdList.innerHTML = `<div class="cmd-empty">No commands matching "<b>${esc(query)}</b>"</div>`;
    return;
  }

  let html = "";
  let lastGroup = "";
  currentCmds.forEach((cmd, idx) => {
    if (cmd.group !== lastGroup) {
      lastGroup = cmd.group;
      html += `<div class="cmd-group-title">${esc(lastGroup)}</div>`;
    }
    const isActive = idx === cmdActiveIndex;
    html += `
      <div class="cmd-item ${isActive ? 'is-active' : ''}" data-cmd-idx="${idx}" role="option" aria-selected="${isActive}">
        <div class="cmd-item-left">
          <span class="cmd-item-icon" aria-hidden="true">${ICONS[cmd.icon] ? icon(cmd.icon) : esc(cmd.icon)}</span>
          <div class="cmd-item-text">
            <span class="cmd-item-name">${esc(cmd.name)}</span>
            <span class="cmd-item-desc">${esc(cmd.desc)}</span>
          </div>
        </div>
        ${cmd.shortcut ? `<kbd class="cmd-item-shortcut">${cmd.shortcut}</kbd>` : ''}
      </div>
    `;
  });
  cmdList.innerHTML = html;

  const activeEl = cmdList.querySelector(".cmd-item.is-active");
  if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
}

function executeActiveCommand() {
  if (!currentCmds.length) return;
  const cmd = currentCmds[cmdActiveIndex];
  closeCmdPalette();
  if (cmd && typeof cmd.action === "function") {
    cmd.action();
  }
}

if (cmdPalette && cmdInput) {
  // Global Shortcut: Ctrl+K or Cmd+K
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      if (!state.user) return;
      e.preventDefault();
      if (cmdPalette.open) closeCmdPalette();
      else openCmdPalette();
    }
  });

  // Trigger button in header
  if (cmdTrigger) {
    cmdTrigger.addEventListener("click", () => openCmdPalette());
  }

  // Backdrop click to close
  cmdPalette.addEventListener("click", (e) => {
    if (e.target === cmdPalette) closeCmdPalette();
  });

  // Input filter
  cmdInput.addEventListener("input", () => {
    cmdActiveIndex = 0;
    filterAndRenderCommands(cmdInput.value);
  });

  // Key navigation inside input
  cmdInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!currentCmds.length) return;
      cmdActiveIndex = (cmdActiveIndex + 1) % currentCmds.length;
      updateActiveItem();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!currentCmds.length) return;
      cmdActiveIndex = (cmdActiveIndex - 1 + currentCmds.length) % currentCmds.length;
      updateActiveItem();
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeActiveCommand();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeCmdPalette();
    }
  });

  function updateActiveItem() {
    $$(".cmd-item", cmdList).forEach((el, idx) => {
      const isAct = idx === cmdActiveIndex;
      el.classList.toggle("is-active", isAct);
      el.setAttribute("aria-selected", String(isAct));
      if (isAct) el.scrollIntoView({ block: "nearest" });
    });
  }

  // Click on command item
  cmdList.addEventListener("click", (e) => {
    const item = e.target.closest(".cmd-item");
    if (!item) return;
    const idx = +item.dataset.cmdIdx;
    cmdActiveIndex = idx;
    executeActiveCommand();
  });
}

