# Authentication Reference

Detailed guide for GRVT CLI authentication setup, session management, and security.

## Overview

GRVT uses API key-based authentication with session cookies. The flow:

1. **Configure** credentials (API key, secret, sub-account ID)
2. **Login** to create a session (valid ~24 hours)
3. **Trade** — sessions auto-refresh when needed

**Authentication required for:** Orders, positions, account info, funding payment history.
**No authentication needed for:** Instruments, ticker, orderbook, funding rates.

## Setup Methods

### Method 1: Interactive Wizard (Recommended)

Best for first-time setup. Guides you through each step and auto-logs in.

```bash
grvt-cli config init
```

Prompts for:

| Field | Format | Description |
|-------|--------|-------------|
| API Key | Alphanumeric string | Your GRVT API key |
| API Secret | `0x`-prefixed hex string | Private key for EIP-712 signing |
| Sub-account ID | Numeric string | Sub-account to trade with |

After entering all values, the wizard saves config and attempts login automatically.

### Method 2: Environment Variables

Best for CI/CD, Docker, and automated environments.

```bash
export GRVT_API_KEY=<your-api-key>
export GRVT_SECRET_KEY=<your-api-secret>
export GRVT_SUB_ACCOUNT_ID=<your-sub-account-id>
```

Then login:

```bash
grvt-cli auth login
```

Environment variables take precedence when a config file value is not set. Config file values override environment variables when both exist.

### Method 3: Manual Config Commands

Best for updating individual values.

```bash
grvt-cli config set --api-key <key>
grvt-cli config set --api-secret <secret>
grvt-cli config set --sub-account-id <id>
grvt-cli auth login
```

Or all at once:

```bash
grvt-cli config set --api-key <key> --api-secret <secret> --sub-account-id <id>
grvt-cli auth login
```

## Session Management

### Login

```bash
grvt-cli auth login
```

Creates a session cookie. Output includes environment, account ID, and expiry time.

### Check Status

```bash
grvt-cli auth status
```

Shows:
- `status` — `Authenticated` or `Not authenticated`
- `env` — Current environment (PRODUCTION)
- `accountId` — Your GRVT account ID
- `expiresIn` — Minutes until session expires
- `expiresAt` — Exact expiry time (ISO 8601)

JSON output:

```bash
grvt-cli auth status -o json
```

```json
{
  "status": "Authenticated",
  "env": "PRODUCTION",
  "accountId": "2qqZia7yBQzDImFYeQ168GWsqjg",
  "expiresIn": "1433 minutes",
  "expiresAt": "2026-03-14T16:39:07.000Z"
}
```

### Logout

```bash
grvt-cli auth logout
```

Deletes the local session file. You will need to `auth login` again before making authenticated requests.

### Auto-Refresh

The CLI automatically refreshes sessions when they expire or are about to expire. You generally don't need to manually re-login during normal operation. If auto-refresh fails (e.g., API key changed), you will see:

```
ERROR: Not authenticated. Session expired or not logged in.

To fix this, run:
  grvt-cli auth login
```

## Viewing Configuration

### List All Config (Secrets Masked)

```bash
grvt-cli config list
```

Output:

```
  env           PRODUCTION
  apiKey        32JIkG...7y0h
  apiSecret     ****0bb7
  subAccountId  5630820161524481
```

### Get Specific Value

```bash
grvt-cli config get env
grvt-cli config get apiKey          # Masked output
grvt-cli config get subAccountId
```

## Updating Credentials

Update individual values without re-running the full wizard:

```bash
# Update API key
grvt-cli config set --api-key <new-key>

# Update secret
grvt-cli config set --api-secret <new-secret>

# Update sub-account
grvt-cli config set --sub-account-id <new-id>

# After changing API key, re-login
grvt-cli auth login
```

Config updates are merged — only the specified fields change, others are preserved.

## Error Recovery

### "API key is not configured"

```
ERROR: API key is not configured.

To fix this, run:
  grvt-cli config set --api-key <your-api-key>
```

**Fix:** Run `grvt-cli config init` for full setup, or set the key directly.

### "API secret is not configured"

```
ERROR: API secret is not configured.

To fix this, run:
  grvt-cli config set --api-secret <your-secret>
```

**Fix:** Set the API secret. This is the private key shown once when you created your API key in the GRVT dashboard.

### "Not authenticated. Session expired or not logged in."

```
ERROR: Not authenticated. Session expired or not logged in.

To fix this, run:
  grvt-cli auth login
```

**Fix:** Run `grvt-cli auth login`. If login fails, verify your API key is still valid in the GRVT dashboard.

### "Login failed: no session cookie received"

```
ERROR: Login failed: no session cookie received.

To fix this, run:
  grvt-cli config set --api-key <your-api-key>
```

**Fix:** Your API key may be invalid or revoked. Generate a new one in the GRVT dashboard and update with `grvt-cli config set --api-key <new-key>`.

### "Request failed with status code 401"

**Fix:** Session is invalid. Run `grvt-cli auth login` to get a fresh session.

## Security Best Practices

### API Key Permissions

- **Always use Trade-only API keys** with the CLI. Never use keys that have withdrawal permissions.
- The API key authenticates your session. The API secret (private key) signs orders locally via EIP-712 — it is **never sent to any server**.

### File Security

| File | Path | Permissions | Contents |
|------|------|-------------|----------|
| Config | `~/.grvt-cli/config.json` | `0600` | API key, secret, sub-account ID |
| Session | `~/.grvt-cli/session.json` | `0600` | Session cookie (auto-managed) |

Both files are created with owner-only read/write permissions. Do not change these permissions.

### Key Safety Rules

1. **Never commit config files to version control.** Add `~/.grvt-cli/` to your `.gitignore`.
2. **Never share your API secret.** It is used for local signing only.
3. **Use environment variables in CI/CD** instead of config files.
4. **Rotate API keys periodically.** Generate a new key in the dashboard and update with `grvt-cli config set --api-key <new-key>`.
5. **Revoke compromised keys immediately** in the GRVT dashboard.
6. **Use separate API keys for different agents/environments.** Don't share keys across production and testing.

### Environment Variable Security

When using environment variables:

```bash
# Good: set in shell profile or .env file (not committed)
export GRVT_API_KEY=...

# Bad: passing on command line (visible in process list and shell history)
GRVT_API_KEY=... grvt-cli auth login  # Don't do this
```

Ensure `.env` files are in `.gitignore` and not committed to version control.

## Obtaining Credentials

### Where to Get API Key and Secret

1. Log into [grvt.io](https://grvt.io)
2. Go to **Settings** > **API Keys**
3. Click **Create API Key**
4. Select **Trade** permission (do NOT enable Withdrawal)
5. Copy the **API Key** and **API Secret**

**Important:** The API Secret is only shown once at creation time. If you lose it, you must create a new API key.

### Where to Find Sub-Account ID

1. Log into [grvt.io](https://grvt.io)
2. Go to **Sub-accounts** section
3. Your sub-account ID is the numeric identifier (e.g., `5630820161524481`)

You can also find it programmatically after login:

```bash
grvt-cli account sub-account -o json
# Look for the sub_account_id field
```
