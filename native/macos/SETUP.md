# macOS Native Host Setup

This setup enables local dictionary lookup on macOS via Firefox Native Messaging.

## Install
From the repository root:

```bash
bash ./scripts/install-macos-native-host.sh
```

Then:
1. Fully quit Firefox.
2. Re-open Firefox.
3. Reload this extension from `about:debugging`.
4. Open popup and click `Check macOS Native`.

Expected status:
- `macOS native dictionary host is connected.`

## Uninstall

```bash
bash ./scripts/uninstall-macos-native-host.sh
```
