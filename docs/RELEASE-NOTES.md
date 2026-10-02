# Aster 0.5.1: Readable view menus

This patch fixes the white, hard-to-read dropdown when adding workspace views. Dropdown options now have dark backgrounds and light lettering matched to all six themes, including Lavender and Paper. It includes the complete Pelagic Labs demo from 0.5.0.

## Download and update

1. Download **Aster-0.5.1-windows-x64.zip** and extract the entire archive.
2. Close the older Aster window, then open **Aster.exe** from the new folder.
3. Keep the accompanying files together. Existing vaults, profiles, and edited demo copies are preserved.

Use this patch instead of the older 0.5.0 download to receive the menu fix. No Node.js, account, or AI key is required. The optional **Pelagic-Labs-demo.zip** is a separate editable vault; the app already includes its first-launch demo.

## Verification

The build passes TypeScript and the automated core suite. All view-menu entries were checked in the packaged app across all six themes, with text contrast above 7:1. The release workflow runs all five packaged desktop suites and audits the distribution before publishing. Verify the ZIPs against **SHA256SUMS.txt**.

This remains an unsigned Windows x64 alpha. The patch does not add automatic updates or cloud sync.

[Getting started](https://github.com/Alfredo12111/Aster/blob/main/docs/GETTING-STARTED.md) · [Demo tour](https://github.com/Alfredo12111/Aster/blob/main/docs/DEMO.md)
