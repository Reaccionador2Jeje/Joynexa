# Joynexa DevGit

DevGit is an integrated GitHub workspace for Joynexa game developers.

## Current capabilities

- Connect a GitHub account through server-side OAuth.
- List public repositories the connected account can access.
- Browse branches and repository file trees.
- Read and edit text files (up to 500 KB per file in the web editor).
- Create branches from an existing branch.
- Preview a local line-based diff.
- Commit up to 20 text files in one commit.
- Browse recent commit history.
- Open a Pull Request from the selected branch to the repository default branch.

The first release requests only `public_repo read:user`. Private repositories and GitLab/Codeberg providers are not enabled in this release.

## Configure GitHub OAuth

Create a GitHub OAuth App with:
- Homepage URL: the deployed Joynexa origin.
- Authorization callback URL: `https://YOUR-JOYNEXA-DOMAIN/api/devgit/github/callback`.

Configure these Worker secrets:

```sh
npx wrangler secret put GITHUB_OAUTH_CLIENT_ID
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
npx wrangler secret put GITHUB_TOKEN_ENCRYPTION_KEY
```

Use a random encryption secret with at least 32 characters. The Worker derives an AES-GCM key from this secret. Access tokens are encrypted before being stored in D1; the raw token is never returned to the browser. Do not commit these secrets or put them in `.dev.vars.example`.

Apply the additive D1 migration:

```sh
npx wrangler d1 migrations apply joynexa-db --remote
```

Deploy the Worker and static assets after configuring secrets and migration.

## OAuth and token security

- OAuth state is random, hashed in D1, expires after ten minutes and is consumed once.
- The OAuth callback exchanges the authorization code server-side.
- The user's GitHub access token is encrypted with AES-GCM and stored in D1.
- Joynexa account sessions remain HttpOnly; GitHub tokens are not stored in localStorage or browser cookies.
- Mutating DevGit API routes require a same-origin request.
- Repository paths and branch names are validated before calling GitHub.
- Disconnecting deletes the stored GitHub token record.

If `GITHUB_TOKEN_ENCRYPTION_KEY` is rotated, existing stored tokens cannot be decrypted. Disconnect and reconnect accounts after rotation, or plan a controlled re-encryption migration first.

## Commit behavior

The editor loads text files from GitHub and keeps one working copy in the current browser tab. Commit sends the edited file content to the Worker. The Worker creates Git blobs, a tree and a commit, then advances the branch without force-pushing. Review the local diff before committing. The first release edits or creates text files; binary assets and file deletion are not supported in the web editor.

A successful commit is pushed directly to the selected branch. Use a feature branch when you want to keep the default branch untouched. Pull Requests are created through GitHub after a branch has commits.

## Troubleshooting

- `DevGit aún necesita configurar...`: add the OAuth app client ID and secret to Worker secrets.
- `encryption_config`: configure `GITHUB_TOKEN_ENCRYPTION_KEY` with at least 32 characters.
- `Conecta tu cuenta GitHub primero`: reconnect from the DevGit page.
- A GitHub 403/404 can mean the connected account lacks permission, the repository is unavailable, or GitHub's API rate/permission rules blocked the request.
- Only text files up to 500 KB are editable in this version.
