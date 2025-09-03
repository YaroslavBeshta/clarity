const listEl = document.getElementById("rule-list");
const formEl = document.getElementById("add-form");
const inputEl = document.getElementById("rule-input");
const msgEl = document.getElementById("message");

// Seen URLs
const loggingEnabledEl = document.getElementById("logging-enabled");
const filterEl = document.getElementById("filter-input");
const clearBtn = document.getElementById("clear-log");
const seenBodyEl = document.getElementById("seen-body");
const seenEmptyEl = document.getElementById("seen-empty");

function formatTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return String(ts);
  }
}

function isValidRegex(s) {
  try {
    let source = s;
    let flags = "";
    const m = s.match(/^\/(.+)\/([gimsuy]*)$/);
    if (m) {
      source = m[1];
      flags = m[2] || "";
    }
    new RegExp(source, flags);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function loadAll() {
  const store = await browser.storage.local.get(["destinationRules", "seenUrls", "loggingEnabled"]);
  renderRules(store.destinationRules || []);
  renderSeen(store.seenUrls || []);
  loggingEnabledEl.checked = typeof store.loggingEnabled === "boolean" ? store.loggingEnabled : true;
}

function renderRules(rules) {
  listEl.innerHTML = "";
  if (!rules.length) {
    const empty = document.createElement("div");
    empty.textContent = "No rules yet.";
    empty.className = "muted";
    listEl.appendChild(empty);
    return;
  }

  for (const rule of rules) {
    const li = document.createElement("li");

    const left = document.createElement("div");
    left.className = "row";
    const code = document.createElement("code");
    code.textContent = rule;
    left.appendChild(code);

    const valid = isValidRegex(rule);
    if (!valid.ok) {
      const warn = document.createElement("span");
      warn.className = "error";
      warn.textContent = "invalid regex";
      left.appendChild(warn);
    }

    const delBtn = document.createElement("button");
    delBtn.textContent = "Remove";
    delBtn.addEventListener("click", async () => {
      const { destinationRules = [] } = await browser.storage.local.get("destinationRules");
      const idx = destinationRules.indexOf(rule);
      if (idx >= 0) {
        destinationRules.splice(idx, 1);
        await browser.storage.local.set({ destinationRules });
      }
    });

    li.appendChild(left);
    li.appendChild(delBtn);
    listEl.appendChild(li);
  }
}

function renderSeen(rows) {
  const q = filterEl.value.trim().toLowerCase();
  const filtered = rows.filter(r => {
    if (!q) return true;
    const hay = `${r.url} ${r.matchedRule || ""} ${r.source || ""}`.toLowerCase();
    return hay.includes(q);
  });

  seenBodyEl.innerHTML = "";
  seenEmptyEl.hidden = filtered.length > 0;

  for (const r of filtered) {
    const tr = document.createElement("tr");

    const tdUrl = document.createElement("td");
    const a = document.createElement("a");
    a.href = r.url;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = r.url;
    tdUrl.appendChild(a);

    const tdRule = document.createElement("td");
    if (r.matchedRule) {
      const code = document.createElement("code");
      code.textContent = r.matchedRule;
      tdRule.appendChild(code);
    } else {
      tdRule.innerHTML = "<span class='muted'>(n/a)</span>";
    }

    const tdSource = document.createElement("td");
    tdSource.textContent = r.source || "";

    const tdTime = document.createElement("td");
    tdTime.className = "right nowrap";
    tdTime.textContent = formatTime(r.ts);

    tr.appendChild(tdUrl);
    tr.appendChild(tdRule);
    tr.appendChild(tdSource);
    tr.appendChild(tdTime);
    seenBodyEl.appendChild(tr);
  }
}

// Add rule form
formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  msgEl.hidden = true;
  const value = inputEl.value.trim();
  if (!value) return;

  const check = isValidRegex(value);
  if (!check.ok) {
    msgEl.textContent = "Invalid regex. Please fix it.";
    msgEl.hidden = false;
    return;
  }

  const { destinationRules = [] } = await browser.storage.local.get("destinationRules");
  if (destinationRules.includes(value)) {
    msgEl.textContent = "Rule already exists.";
    msgEl.hidden = false;
    return;
  }

  destinationRules.push(value);
  await browser.storage.local.set({ destinationRules });
  inputEl.value = "";
});

// Toggle logging
loggingEnabledEl.addEventListener("change", async () => {
  await browser.storage.local.set({ loggingEnabled: loggingEnabledEl.checked });
});

// Clear log
clearBtn.addEventListener("click", async () => {
  await browser.storage.local.set({ seenUrls: [] });
});

// Filter changes
filterEl.addEventListener("input", async () => {
  const { seenUrls = [] } = await browser.storage.local.get("seenUrls");
  renderSeen(seenUrls);
});

// Live re-render on storage changes
browser.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.destinationRules) {
    renderRules(changes.destinationRules.newValue || []);
  }
  if (changes.seenUrls) {
    renderSeen(changes.seenUrls.newValue || []);
  }
  if (changes.loggingEnabled) {
    loggingEnabledEl.checked = !!changes.loggingEnabled.newValue;
  }
});

// Initial load
loadAll();
