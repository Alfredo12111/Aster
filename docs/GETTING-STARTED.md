# Open and run Aster

## Windows download — no development tools needed

1. Open [Aster Releases](https://github.com/Alfredo12111/Aster/releases).
2. Download the asset named `Aster-<version>-windows-x64.zip`. The automatically generated **Source code** archives are for developers, not the runnable app.
3. Right-click the ZIP and choose **Extract All**. Extract it to a normal writable folder, such as a folder under Documents. Do not run it from inside the ZIP.
4. Open the extracted folder and double-click **Aster.exe**. Keep all the accompanying files and folders together; the executable needs them.

The current Windows x64 build is unsigned. Windows may show a reputation warning. Check that the download comes from the repository linked above and compare its SHA-256 checksum with the release's `SHA256SUMS.txt` before deciding to run it:

```powershell
Get-FileHash .\Aster-0.3.1-windows-x64.zip -Algorithm SHA256
```

This directory build does not install a Windows service or require Node.js. You may move the extracted app folder later. Your notes and app settings are stored separately from that folder; this is not a fully portable user profile.

## Your first five minutes

1. Aster opens a synthetic **Aster Welcome** vault. Try dragging nodes and changing graph colors in the Appearance panel.
2. Choose **New vault** for a new notes folder or **Open** for an existing Markdown folder. Back up important notes before trying an alpha build.
3. Create a note with **Ctrl+N**. Add `[[Another note]]` to connect it. **Graph / Split / Write** changes the workspace layout.
4. Open the **puzzle icon** on the left. Enable Calendar, Tasks & Projects, PDF Library, Canvas, Navigator, Charts, or Kanban for this vault. All modules are optional; switching one off preserves its data.
5. Use **Ctrl+P** to jump to a note. Use the folder icon beside **Stored on this device** to find the active vault on disk.

No account, API key, or internet connection is required for local notes and modules. The optional AI feature needs your own provider key and model ID, entered in **AI settings**. It sends note excerpts only when you explicitly request suggestions. Do not place keys in notes or repository files.

## Make it your workspace

- Use **＋ View** in a pane to add Web, Text, Calendar, PDF Annotation, Charts, Kanban, or another tool. Enable optional modules from the puzzle icon first.
- Use **Split pane right** or **Split pane below** beside the tabs. Drag the border between panes; double-click it to reset to equal sizes. The focused border also accepts arrow keys.
- Drag tabs to another pane. **Save layout** names the arrangement; **Saved layouts** restores it. The current arrangement also returns on restart.
- Use **Appearance & themes** on the lower left for six themes, including Cyber and Lavender.
- In **Charts**, try sample data or import CSV/XLSX. Edit cells in the formula bar, select a range with its header row, and choose **Chart selection**. Configure the chart on the right.
- In **Kanban**, create a board, add cards, and drag them between columns. They are the same tasks shown in Tasks and Calendar.

## Where your work lives

- Notes are regular Markdown files in your vault folder.
- `.aster/vault.json` preserves note identities, graph views and accepted relationships.
- `.aster/modules.json` preserves module settings, tasks, projects, Canvas cards, PDF annotations, chart workbooks, Kanban boards, layouts and themes.
- `Attachments/` holds imported PDFs. Their original bytes are not edited.
- `.aster/history`, `.aster/module-history` and `.aster/trash` retain recovery data.

Back up the entire vault, including hidden `.aster` files and attachments. API keys are encrypted in the local application profile and are not saved in the vault. The first-run welcome vault also lives in that profile; the folder button shows its actual location.

## Update an existing download

Close Aster, download the new ZIP from Releases, and extract it into a new folder. Open the new Aster.exe. Do not copy a personal vault or app profile into the application folder. Keep a vault backup before updating. The app currently has no automatic updater or cloud sync.

## Run from source

Install [Git](https://git-scm.com/downloads) and [Node.js 24 or newer](https://nodejs.org/en/download), then open PowerShell:

```powershell
git clone https://github.com/Alfredo12111/Aster.git
cd Aster
npm ci
node node_modules/electron/install.js
npm run dev
```

The explicit Electron install step handles npm configurations that skip dependency installation scripts. `npm run dev` opens the desktop app and a local development server. Renderer edits reload automatically. Restart the command after changing the native host or preload.

To build and run the compiled app:

```powershell
npm run build
npm start
```

To create a runnable Windows directory:

```powershell
npm run package
```

Open `release/win-unpacked/Aster.exe`, or double-click **Start Aster.cmd** in the source checkout. Packaging is currently verified on Windows x64.

## Checks for contributors

```powershell
npm run build
npm test
npm run test:desktop
npm run test:modules
npm run test:visual
npm run audit:publish
```

Desktop tests use separate generated profiles and synthetic notes. They do not use your personal vault or make paid AI requests. Read [CONTRIBUTING.md](../CONTRIBUTING.md) before publishing changes or release assets.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Aster.exe will not open after download | Extract the whole ZIP and keep its DLLs, locales and resources folders next to the executable. |
| `npm` is not recognized | Install Node.js and open a new PowerShell window. |
| Electron executable is missing | Run `node node_modules/electron/install.js`, then retry. |
| A module is missing | Open the puzzle icon and enable that module for the current vault. |
| A PDF has no selectable text | Scanned pages support region comments and freehand ink. OCR is not included. |
| A save reports a conflict | Keep the draft, inspect the file changed on disk, then use the displayed reload or draft-copy action. |
| AI suggestions fail | Check your provider, model ID, key and provider account access. Local notes still work without AI. |

For all module controls and Aster Query examples, see the [feature guide](FEATURES.md). Current limits and test coverage are in [VALIDATION.md](VALIDATION.md).
