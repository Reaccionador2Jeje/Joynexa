# Joynexa DevGit — Independent Local Git Studio

DevGit is an independent, browser-local development workspace. It does not require a Joynexa account, GitHub OAuth, personal access tokens, Worker secrets, D1 tables or a server-side GitHub integration.

## What it does
- Create a local project workspace.
- Import source code from a public GitHub repository using only its public repository metadata, tree and raw source files.
- Edit text files in the browser.
- Create local branches and local commits with snapshots.
- Review the current file diff and local commit history.
- Export a text patch or project files.

## Independence boundary
GitHub is used only as an optional public source-code origin during import. DevGit does not call GitHub OAuth, GitHub account, repository-management, Pull Request, issue, workflow or other GitHub account features. It does not push commits to GitHub or any remote. No GitHub credentials or Joynexa session are requested.

All editing, branches, commit snapshots and history are stored in the browser's IndexedDB. Clearing browser site data can erase these local workspaces; export work regularly.

## Current limitations
This is a local Git-style workspace, not yet a complete implementation of the Git object/pack protocol. It does not clone private repositories, push/fetch remote commits, merge branches, resolve conflicts, preserve binary assets, or export a full Git metadata directory. Public repository import currently filters for text-oriented source files and caps the import to 300 files of up to 200 KB each.

## Future direction
A later native desktop/CLI companion can provide full Git compatibility (clone, fetch, merge, rebase, push) without tying DevGit to GitHub-specific APIs. Remotes should remain provider-neutral and use the user's own Git credentials outside Joynexa server secrets.