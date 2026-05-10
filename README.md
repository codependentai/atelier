# Atelier

A workshop for HTML and Markdown. Local-first, file-native, agent-friendly — a workspace for the artifacts your agents (and you) make. Real `.html` and `.md` files, real relative links, durable graph context. The same shape Obsidian gives Markdown, but for the format Claude Code, Codex, and other agents are increasingly producing as a first-class output.

The thesis: HTML is becoming the new Markdown for agent work. It already runs everywhere, it carries its own styling, and it links naturally. What it's been missing is a workshop — somewhere artifacts can live, link to each other, get inspected, and feed back into the next prompt. Markdown lives alongside HTML, the way reality calls for: short notes stay markdown, long-form artifacts go HTML.

## Install

```bash
npm install -g @codependentai/atelier
atelier --help
```

The desktop app is at [atelier.codependentai.io](https://atelier.codependentai.io).

## Three surfaces, one core

- **Desktop app** — open a folder, browse a tree, edit in Monaco, preview in a sandboxed iframe with click-routing to other vault files, see backlinks and missing links in the inspector, view the link graph, drag/drop files, right-click for full file ops, settings panel with vault switcher.
- **CLI** — `atelier index|inspect|context|search|link-check|lint|init|create|update|move|rename|duplicate|delete|mkdir|import|watch|templates|prompt` — read and write the vault from any shell. Stable JSON output (`schemaVersion: 1`) for agent consumption.
- **Demo vault** — seeded set of cross-linked HTML pages so the app has something to show on first launch.

The shared vault logic lives in `core/` — indexer, link classifier, vault-ops (single source of truth for read/write), metadata writer, vault config reader, settings, vault context, path-traversal guards.

## Running from source

```bash
pnpm install
pnpm dev          # Electron + Vite, hot-reload
pnpm build        # typecheck + build cli, electron, and renderer
pnpm test         # vitest
pnpm atelier      # run the CLI from source
```

Requires Node 20+ and pnpm.

To install the CLI from a local checkout:

```bash
pnpm build:cli
npm link          # registers `atelier` globally
```

## CLI reference (schema v1)

### Read

```bash
atelier index <vault> [--json]
atelier inspect <vault> <file> [--json]
atelier context <vault> --file <file> [--include-source] [--json]
atelier search <vault> <query> [--in body,title,tags,headings|all] [--limit N] [--case-sensitive] [--json]
atelier link-check <vault> [--json]
atelier lint <vault> [--json]
```

### Write

```bash
atelier init <path> [--name "Display Name"] [--no-welcome] [--json]
atelier create <vault> <path> [--title T] [--template name] [--content C | --from-stdin] [--json]
atelier create <vault> --title T [--format html|md] [--template name] [--json]
atelier import <vault> <file...> [--target <dir>] [--json]
atelier update <vault> <file> [--content C | --from-stdin] [--json]
atelier templates <vault> [--json]
atelier move <vault> <from> <to> [--json]
atelier rename <vault> <file> <new-name> [--json]
atelier duplicate <vault> <file> [--json]
atelier delete <vault> <file> [--json]
atelier mkdir <vault> <folder> [--json]
```

### Stream

```bash
atelier watch <vault>   # NDJSON events on stdout, SIGINT to stop
```

### Prompt scaffolds

```bash
atelier prompt create <vault>
atelier prompt revise <vault> --file <file>
```

Every `--json` response carries a top-level `schemaVersion: 1` and a `command` field. The schema is the agent contract — breaking changes will bump the version.

## Markdown support

Markdown files (`.md`, `.markdown`) live alongside HTML in the same vault. The indexer extracts:

- **Title** — from YAML frontmatter `title:`, then first `<h1>`, then filename
- **Description** — from frontmatter `description:`, then first paragraph
- **Tags** — from frontmatter `tags: [...]` or list form
- **Headings** — H1/H2/H3
- **Links** — both standard `[text](path)` and Obsidian-style `[[wikilinks]]`. Wikilinks resolve case-insensitively against any file basename in the vault.

The preview server renders `.md` to HTML on the fly with a clean reader-mode template (theme-aware). The Electron editor switches Monaco's language to `markdown` automatically based on extension.

## Vault config

Optional per-vault config at `<vault>/.htmlvault/config.json` (the on-disk folder name is `.htmlvault` for backward compatibility — kept stable so existing vaults keep working):

```json
{
  "vaultName": "My Vault",
  "defaultTemplate": "decision-log",
  "ignoredPaths": ["drafts/"]
}
```

When `defaultTemplate` is set, new files use that template by default. The CLI's `create` command also accepts `--template <name>` to override per-call. Edit it from the GUI via the Settings dialog (gear icon in the topbar).

## Templates

Drop files into `<vault>/.htmlvault/templates/`. Filename stem becomes the template name; extension determines format (`.html`/`.md`). Inside templates, `{{title}}` is replaced with the new file's title at create time. `{{date}}` is replaced with `YYYY-MM-DD`.

## Theming

Toggle between dark and light via the Settings → Appearance tab, or `Cmd/Ctrl + K → "Switch to ..."`. The whole app — including the markdown reader template — responds to the theme. Default palette is champagne bronze on warm obsidian.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Open command palette |
| `Cmd/Ctrl + N` | New HTML file |
| `Cmd/Ctrl + Shift + N` | New Markdown file |
| `Cmd/Ctrl + S` | Save current file |

## Drag and drop

- **Inside the sidebar:** drag a file onto a folder to move it
- **From OS file manager:** drop files anywhere on the app to import to vault root, or drop onto a specific folder in the sidebar to land them there
- **Conflict handling:** moves throw on existing target; imports auto-rename (`file-2.html`)

## Right-click context menu

On a file: open in browser, reveal in file manager, rename (inline), duplicate, move to trash. On a folder: new HTML/Markdown/Folder here, reveal. On empty tree area: new HTML/Markdown/Folder.

## Known edge case

If you have a file open in the editor with unsaved changes and the CLI overwrites the same file on disk, the editor doesn't auto-reload — Monaco holds the unsaved buffer. Hitting Save in the editor will overwrite the CLI's version. **Save (or close) the file in the GUI before manipulating it via CLI.** Same gotcha as editing an Obsidian note in two places at once.

## Design choices

- HTML and Markdown stay portable. Atelier doesn't add custom syntax, sidecar files, or proprietary frontmatter — anything you put in here works on its own with `python -m http.server` or any static host. Vault-specific metadata lives in standard `<meta>` tags or YAML frontmatter.
- The renderer never touches the filesystem directly. All reads, writes, and indexing go through the Electron main process behind path guards.
- Preview is sandboxed (`allow-scripts allow-forms`, no same-origin). Vault HTML can run JS but can't reach the host app or other origins.
- The CLI and GUI share the same `core/vault-ops` module. Anything that works in the GUI works at the command line, with the same validation and the same error messages.

## License

[Codependent AI Source-Available License](LICENSE). Free for personal and non-commercial use; commercial use requires a license from [Codependent AI](https://codependentai.io). Made with care.
