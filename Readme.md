# Clarity · Block Brainrot, regain focus

Clarity helps you take back control of your attention by blocking addictive, low-value content like YouTube Shorts, TikTok, Instagram Reels, and similar infinite-scroll feeds. Stay sharp and focus on what matters.

## Features

- 🚫 Blocks YouTube Shorts, TikTok, Instagram Reels, and more
- 🧠 Simple, distraction-free design
- ⚡ Lightweight and privacy-friendly (no data collection)

![Demo](demo.gif)

---

## Install in Firefox (temporary)

1. Open Firefox.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select `manifest.json` inside the extension folder.
5. The extension appears in the list. Use **Reload** here any time you change files.

Notes

- Temporary add-ons are removed when Firefox restarts.
- After edits, click **Reload** next to the add-on.

## Usage

- Open **about:addons** → **Extensions** → Clarity → **Preferences** to manage rules.
- If you added a toolbar button in the manifest, click it to open the options page.

## Allow in Private Windows (optional)

1. Open **about:addons**.
2. Select Clarity.
3. Under **Run in Private Windows**, choose **Allow**.

## Permissions

- `webRequest`, `webRequestBlocking`, `webNavigation`, `tabs`, `storage`, `<all_urls>`  
  Used to observe navigations, apply redirects, and save your rules locally.

## Privacy

Clarity does not collect or send any data. All rules and logs stay in your browser.

## Update or remove

- Temporary install: return to `about:debugging` and click **Reload** or **Remove**.

## Contributions

If you experience any issues, please open an issue at [Issues](https://github.com/your-org/your-repo/issues).
