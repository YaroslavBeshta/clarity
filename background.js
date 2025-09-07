console.log("background.js loaded");

// ------------------- Constants -------------------
const TARGET = browser.runtime.getURL("src/redirect/redirect.html");

const isAtTarget = (url) => url.startsWith(TARGET);

const DEFAULT_RULES = [
  "youtube.com/shorts/*",
  "tiktok.com/*",
  "instagram.com/*",
];

const DEFAULT_LOGGING_ENABLED = true;
const MAX_SEEN = 300;

// ------------------- Globals -------------------
let compiledRules = [];

// ------------------- Helpers -------------------
async function getRuleStrings() {
  const { destinationRules } = await browser.storage.local.get(
    "destinationRules"
  );
  return Array.isArray(destinationRules) ? destinationRules : null;
}

async function ensureRulesInitialized() {
  const existing = await getRuleStrings();
  if (!existing) {
    await browser.storage.local.set({ destinationRules: DEFAULT_RULES });
  }
}

function compileRules(ruleStrings) {
  const list = [];
  const sources = [];
  for (const s of ruleStrings) {
    try {
      let source = s;
      let flags = "";
      const m = s.match(/^\/(.+)\/([gimsuy]*)$/);
      if (m) {
        source = m[1];
        flags = m[2] || "";
      }
      list.push(new RegExp(source, flags));
      sources.push(s);
    } catch (e) {
      console.warn("Invalid rule skipped:", s, e);
    }
  }
  compiledRules = list;
  compiledRules.__sources = sources;
}

async function loadAndCompileRules() {
  const rules = await getRuleStrings();
  compileRules(rules || DEFAULT_RULES);
}

function matchesAny(url, regexes) {
  return regexes.some((rx) => rx.test(url));
}

function findMatchingRuleString(url) {
  const ruleStrings = compiledRules.__sources || [];
  for (let i = 0; i < compiledRules.length; i++) {
    if (compiledRules[i].test(url)) return ruleStrings[i] || null;
  }
  return null;
}

// ------------------- Logging -------------------
async function getLoggingEnabled() {
  const { loggingEnabled } = await browser.storage.local.get("loggingEnabled");
  return typeof loggingEnabled === "boolean"
    ? loggingEnabled
    : DEFAULT_LOGGING_ENABLED;
}

async function recordMatch({ url, source, matchedRule }) {
  if (!(await getLoggingEnabled())) return;
  const { seenUrls = [] } = await browser.storage.local.get("seenUrls");
  seenUrls.unshift({
    url,
    matchedRule: matchedRule || null,
    source,
    ts: Date.now(),
  });
  if (seenUrls.length > MAX_SEEN) seenUrls.length = MAX_SEEN;
  await browser.storage.local.set({ seenUrls });
}

// ------------------- Google redirector -------------------
const googleRedirector =
  /^https?:\/\/(?:www|news|maps|encrypted|duck)\.google\.[^/]+\/(?:url|imgres)/i;

function extractGoogleDestination(url) {
  try {
    const u = new URL(url);
    const p = u.searchParams;
    return p.get("q") || p.get("url") || p.get("imgurl") || null;
  } catch {
    return null;
  }
}

// ------------------- Handlers -------------------
function handleBeforeRequest(details) {
  const { url, tabId } = details;
  if (isAtTarget(url)) return {};

  // Google wrapped redirect
  if (googleRedirector.test(url)) {
    const dest = extractGoogleDestination(url);
    if (dest && !isAtTarget(dest) && matchesAny(dest, compiledRules)) {
      const matchedRule = findMatchingRuleString(dest);
      recordMatch({ url: dest, source: "Google-wrapped", matchedRule });
      // Navigate tab directly, then cancel this request
      if (tabId >= 0) {
        try {
          browser.tabs.update(tabId, { url: TARGET });
        } catch (e) {
          console.error(e);
        }
      }
      return { cancel: true };
    }
    return {};
  }

  // Normal case
  if (matchesAny(url, compiledRules)) {
    const matchedRule = findMatchingRuleString(url);
    recordMatch({ url, source: "webRequest", matchedRule });
    if (tabId >= 0) {
      try {
        browser.tabs.update(tabId, { url: TARGET });
      } catch (e) {
        console.error(e);
      }
    }
    return { cancel: true };
  }
  return {};
}

function shouldRedirectSPA(url) {
  try {
    const u = new URL(url);
    // Check if the URL matches any of your compiled rules
    return matchesAny(url, compiledRules) && !isAtTarget(url);
  } catch {
    return false;
  }
}

// ------------------- Listeners -------------------
browser.webRequest.onBeforeRequest.addListener(
  handleBeforeRequest,
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["blocking"]
);

browser.webNavigation.onHistoryStateUpdated.addListener(
  async ({ tabId, url, frameId }) => {
    if (frameId !== 0) return;
    if (shouldRedirectSPA(url)) {
      recordMatch({
        url,
        source: "SPA-historyState",
        matchedRule: null, // No specific rule for SPA history state
      });
      try {
        await browser.tabs.update(tabId, { url: TARGET });
      } catch (e) {
        console.error(e);
      }
    }
  }
);

browser.webNavigation.onCommitted.addListener(
  async ({ tabId, url, frameId }) => {
    if (frameId !== 0) return;
    if (shouldRedirectSPA(url)) {
      recordMatch({
        url,
        source: "SPA-committed",
        matchedRule: null, // No specific rule for SPA committed
      });
      try {
        await browser.tabs.update(tabId, { url: TARGET });
      } catch (e) {
        console.error(e);
      }
    }
  }
);

// ------------------- Init -------------------
browser.runtime.onInstalled.addListener(async () => {
  await ensureRulesInitialized();
  const { loggingEnabled } = await browser.storage.local.get("loggingEnabled");
  if (typeof loggingEnabled !== "boolean") {
    await browser.storage.local.set({
      loggingEnabled: DEFAULT_LOGGING_ENABLED,
    });
  }
  await loadAndCompileRules();
});

loadAndCompileRules();

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.destinationRules) {
    compileRules(changes.destinationRules.newValue || []);
  }
});

// ------------------- Messages (optional API for popup/options) -------------------
browser.runtime.onMessage.addListener(async (msg) => {
  if (msg?.type === "ADD_RULE" && typeof msg.value === "string") {
    const { destinationRules = [] } = await browser.storage.local.get(
      "destinationRules"
    );
    destinationRules.push(msg.value);
    await browser.storage.local.set({ destinationRules });
    return { ok: true };
  }
  if (msg?.type === "REMOVE_RULE" && typeof msg.value === "string") {
    const { destinationRules = [] } = await browser.storage.local.get(
      "destinationRules"
    );
    const idx = destinationRules.indexOf(msg.value);
    if (idx >= 0) {
      destinationRules.splice(idx, 1);
      await browser.storage.local.set({ destinationRules });
    }
    return { ok: true };
  }
  if (msg?.type === "LIST_RULES") {
    const { destinationRules = [] } = await browser.storage.local.get(
      "destinationRules"
    );
    return { rules: destinationRules };
  }
  if (msg?.type === "LIST_SEEN") {
    const { seenUrls = [] } = await browser.storage.local.get("seenUrls");
    return { seen: seenUrls };
  }
  return {};
});
