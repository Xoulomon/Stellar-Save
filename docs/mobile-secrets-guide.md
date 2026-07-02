# Mobile CI/CD Secrets Configuration Guide

**⚠️ SECURITY CRITICAL**: This guide handles sensitive credentials. Follow security best practices.

## Overview

This guide walks you through configuring all required secrets for mobile CI/CD. **Never commit these secrets to version control.**

## Secrets Checklist

### iOS Secrets (8 required)

- [ ] `APPLE_ID`
- [ ] `APPLE_TEAM_ID`
- [ ] `APP_STORE_CONNECT_TEAM_ID`
- [ ] `FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD`
- [ ] `IOS_DISTRIBUTION_CERTIFICATE_P12`
- [ ] `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`
- [ ] `MATCH_GIT_URL`
- [ ] `MATCH_GIT_BASIC_AUTHORIZATION`
- [ ] `MATCH_PASSWORD`

### Android Secrets (5 required)

- [ ] `ANDROID_KEYSTORE_BASE64`
- [ ] `ANDROID_KEYSTORE_PASSWORD`
- [ ] `ANDROID_KEY_ALIAS`
- [ ] `ANDROID_KEY_PASSWORD`
- [ ] `PLAY_STORE_JSON_KEY`

## Setup Instructions

### Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up: https://developer.apple.com/programs/

2. **Google Play Console Account** ($25 one-time)
   - Sign up: https://play.google.com/console/signup

3. **Tools**:
   ```bash
   # macOS (for iOS)
   brew install fastlane
   
   # All platforms
   gem install fastlane
   ```

---

## Part 1: iOS Setup

### Step 1: Get Apple IDs

1. **APPLE_ID**
   ```
   Value: your-email@example.com
   Location: Your Apple ID email
   ```

2. **APPLE_TEAM_ID**
   - Go to: https://developer.apple.com/account/#/membership
   - Copy "Team ID"
   ```
   Value: ABC1234DEF
   ```

3. **APP_STORE_CONNECT_TEAM_ID**
   - Go to: https://appstoreconnect.apple.com/
   - Click your name → View All Teams
   - Note the Team ID
   ```
   Value: 123456789
   ```

### Step 2: Generate App-Specific Password

1. Go to: https://appleid.apple.com/account/manage
2. Sign in
3. Security → App-Specific Passwords → Generate Password
4. Name: "GitHub Actions CI/CD"
5. Copy the password (shown once!)

```
Secret: FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD
Value: abcd-efgh-ijkl-mnop
```

### Step 3: Create Certificates Repository

This private repo stores your iOS certificates securely.

```bash
# 1. Create private GitHub repo
# Go to GitHub → New Repository
# Name: ios-certificates
# Private: ✓
# Initialize: ✓

# 2. Clone locally
git clone https://github.com/YOUR_ORG/ios-certificates.git
cd ios-certificates

# 3. Add .gitignore
cat > .gitignore << 'EOF'
# Don't ignore these - they're encrypted by match
!*.cer
!*.p12
!*.mobileprovision
EOF

git add .gitignore
git commit -m "Initial commit"
git push
```

```
Secret: MATCH_GIT_URL
Value: https://github.com/YOUR_ORG/ios-certificates.git
```

### Step 4: Generate Match Password

Choose a strong password for encrypting certificates.

```bash
# Generate random password
openssl rand -base64 32
```

```
Secret: MATCH_PASSWORD
Value: [generated password]
⚠️ SAVE THIS - You'll need it to decrypt certificates!
```

### Step 5: Create Personal Access Token for Match

1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token (classic)
3. Name: "Fastlane Match"
4. Scopes: `repo` (all)
5. Generate token
6. Copy token

```bash
# Encode for GitHub secret
echo -n "YOUR_GITHUB_USERNAME:YOUR_TOKEN" | base64
```

```
Secret: MATCH_GIT_BASIC_AUTHORIZATION
Value: [base64 encoded]
```

### Step 6: Initialize Fastlane Match

```bash
cd frontend/ios
bundle install

# Initialize match (if not already done)
bundle exec fastlane match init

# Generate certificates
export MATCH_PASSWORD="your-match-password"
export MATCH_GIT_URL="https://github.com/YOUR_ORG/ios-certificates.git"
export MATCH_GIT_BASIC_AUTHORIZATION="base64-encoded-token"

bundle exec fastlane match appstore
```

This creates and uploads certificates to your certificates repo.

### Step 7: Export Distribution Certificate

```bash
# 1. Open Keychain Access (macOS)
# 2. Find "Apple Distribution: YOUR_NAME (TEAM_ID)"
# 3. Right-click → Export
# 4. Format: Personal Information Exchange (.p12)
# 5. Save as: distribution.p12
# 6. Enter export password (remember this!)

# 7. Base64 encode
base64 -i distribution.p12 -o distribution.txt

# 8. Copy contents of distribution.txt
cat distribution.txt
```

```
Secret: IOS_DISTRIBUTION_CERTIFICATE_P12
Value: [contents of distribution.txt]

Secret: IOS_DISTRIBUTION_CERTIFICATE_PASSWORD
Value: [password you entered in step 6]
```

---

## Part 2: Android Setup

### Step 1: Generate Keystore

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias stellarsave \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# You'll be prompted for:
# - Keystore password (remember this!)
# - Key password (can be same as keystore)
# - Name, Organization, etc.
```

**IMPORTANT:** Save these details securely!

```
Keystore password: _______________
Key alias: stellarsave
Key password: _______________
```

### Step 2: Encode Keystore

```bash
base64 -i release.keystore -o keystore.txt
cat keystore.txt
```

```
Secret: ANDROID_KEYSTORE_BASE64
Value: [contents of keystore.txt]

Secret: ANDROID_KEYSTORE_PASSWORD
Value: [keystore password from Step 1]

Secret: ANDROID_KEY_ALIAS
Value: stellarsave

Secret: ANDROID_KEY_PASSWORD
Value: [key password from Step 1]
```

**⚠️ BACKUP YOUR KEYSTORE:**
```bash
# Store in secure location (NOT in repo)
cp release.keystore ~/secure-backup/stellar-save-release.keystore
```

### Step 3: Create Play Console Service Account

1. Go to: https://play.google.com/console/
2. Select your app (create if needed)
3. Setup → API Access
4. Click "Create new service account"
5. Follow link to Google Cloud Console

**In Google Cloud Console:**

6. Create Service Account:
   - Name: `stellar-save-ci-cd`
   - ID: `stellar-save-ci-cd`
   - Description: "GitHub Actions CI/CD"
7. Click "Create and Continue"
8. Grant Role: "Service Account User"
9. Click "Continue" → "Done"

10. Create Key:
    - Click on the service account you just created
    - Keys tab → Add Key → Create new key
    - Type: JSON
    - Create

**Back in Play Console:**

11. Grant Access:
    - Setup → API Access
    - Find your service account
    - Grant Access
    - Permissions:
      - App information: View (read-only)
      - Release management: Manage testing tracks
    - Save

12. Download JSON key file

```bash
# Copy contents of JSON file
cat ~/Downloads/stellar-save-ci-cd-*.json
```

```
Secret: PLAY_STORE_JSON_KEY
Value: [entire JSON contents]
```

---

## Part 3: Configure GitHub Secrets

### Via GitHub UI

1. Go to your repository on GitHub
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add each secret:
   - Name: `SECRET_NAME`
   - Value: `secret value`
5. Click "Add secret"

### Via GitHub CLI

```bash
# Install GitHub CLI
brew install gh  # macOS
# or: https://cli.github.com/

# Authenticate
gh auth login

# Set secrets
gh secret set APPLE_ID -b "your-email@example.com"
gh secret set APPLE_TEAM_ID -b "ABC1234DEF"
gh secret set APP_STORE_CONNECT_TEAM_ID -b "123456789"

# From file
gh secret set IOS_DISTRIBUTION_CERTIFICATE_P12 < distribution.txt
gh secret set ANDROID_KEYSTORE_BASE64 < keystore.txt
gh secret set PLAY_STORE_JSON_KEY < service-account.json

# List all secrets
gh secret list
```

---

## Part 4: Verification

### Test iOS Setup

```bash
cd frontend/ios

# Test match access
export MATCH_PASSWORD="your-match-password"
export MATCH_GIT_URL="your-certificates-repo-url"
export MATCH_GIT_BASIC_AUTHORIZATION="your-base64-token"

bundle exec fastlane match appstore --readonly

# Should succeed and download certificates
```

### Test Android Setup

```bash
cd frontend/android

# Test keystore
keytool -list -v -keystore ~/path/to/release.keystore

# Should show certificate details
```

### Test CI Pipeline

```bash
# Create test branch
git checkout -b test/mobile-ci

# Make trivial change
echo "// test" >> frontend/src/App.tsx

# Commit and push
git add .
git commit -m "test: verify mobile CI"
git push origin test/mobile-ci

# Open PR and watch CI run
gh pr create --title "Test: Mobile CI" --body "Testing CI setup"
```

---

## Security Best Practices

### ✅ DO

- ✅ Store secrets in password manager (1Password, LastPass)
- ✅ Back up keystores/certificates securely
- ✅ Use different keystores for debug/release
- ✅ Rotate secrets every 90 days
- ✅ Enable 2FA on all accounts
- ✅ Review who has access to secrets
- ✅ Audit secret usage logs

### ❌ DON'T

- ❌ Commit secrets to Git
- ❌ Share secrets via email/Slack
- ❌ Use same password for multiple secrets
- ❌ Store secrets in plain text
- ❌ Give secrets to contractors without audit
- ❌ Reuse production keys in development

### Secret Rotation Schedule

| Secret | Rotation Period | Action |
|--------|----------------|--------|
| App-specific password | 90 days | Regenerate in Apple ID |
| Personal access token | 90 days | Regenerate in GitHub |
| Service account key | 90 days | Create new key in GCP |
| Keystore | Never* | Back up securely |
| Certificates | Yearly** | Renewed by Apple |

*Once created, Android keystores should never change
**iOS certificates auto-renew but verify annually

---

## Troubleshooting

### "Authentication failed" (iOS)

1. Verify `APPLE_ID` is correct
2. Check app-specific password is valid
3. Try generating new app-specific password
4. Ensure 2FA is enabled

### "Certificate not found" (iOS)

1. Run `bundle exec fastlane match appstore` locally
2. Check certificates repo has files
3. Verify `MATCH_GIT_BASIC_AUTHORIZATION` is correct
4. Try regenerating certificates with `--force`

### "Keystore not found" (Android)

1. Verify `ANDROID_KEYSTORE_BASE64` is valid base64
2. Check encoding: `echo $SECRET | base64 --decode > test.keystore`
3. Verify keystore: `keytool -list -keystore test.keystore`

### "Service account has no access" (Android)

1. Go to Play Console → API Access
2. Find service account
3. Verify permissions include "Release management"
4. Wait up to 24 hours for permissions to propagate

---

## Emergency Procedures

### Lost Keystore (Android)

⚠️ **CRITICAL**: If you lose the Android keystore, you CANNOT update the app in Play Store!

1. Check all backups immediately
2. If truly lost:
   - Create new app in Play Console
   - New package name
   - Migrate users (if possible)

Prevention:
```bash
# Backup to multiple locations
cp release.keystore ~/Dropbox/backups/
cp release.keystore ~/external-drive/backups/
# Store in company password manager
```

### Compromised Secrets

If secrets are compromised:

**iOS:**
1. Revoke certificates: https://developer.apple.com/account/resources/certificates
2. Regenerate app-specific password
3. Run `fastlane match nuke` to delete all certificates
4. Run `fastlane match appstore` to regenerate
5. Update all GitHub secrets

**Android:**
1. Generate new keystore (see above)
2. Create new Play Console service account
3. Revoke old service account
4. Update all GitHub secrets

**GitHub:**
1. Delete compromised secrets
2. Rotate affected credentials
3. Generate new secrets
4. Review access logs

---

## Support

### Getting Help

1. **Documentation**: See `docs/mobile-cicd-setup.md`
2. **GitHub Issues**: Tag with `mobile-cicd`
3. **Team Slack**: #mobile-releases channel

### Useful Commands

```bash
# Verify secrets are set
gh secret list

# Test Fastlane locally (iOS)
cd frontend/ios
bundle exec fastlane test

# Test Fastlane locally (Android)
cd frontend/android
bundle exec fastlane test

# View certificate info
security find-identity -v -p codesigning

# View keystore info
keytool -list -v -keystore release.keystore
```

---

## Checklist: First-Time Setup

### iOS
- [ ] Apple Developer account created
- [ ] App created in App Store Connect
- [ ] Team IDs noted
- [ ] App-specific password generated
- [ ] Certificates repo created
- [ ] Match initialized
- [ ] Certificates generated
- [ ] Distribution certificate exported
- [ ] All 8 secrets added to GitHub
- [ ] Local test successful
- [ ] CI test successful

### Android
- [ ] Play Console account created
- [ ] App created in Play Console
- [ ] Keystore generated
- [ ] Keystore backed up (3+ locations)
- [ ] Service account created
- [ ] Service account key downloaded
- [ ] Permissions granted
- [ ] All 5 secrets added to GitHub
- [ ] Local test successful
- [ ] CI test successful

---

## Appendix

### A. Secret Value Formats

**Base64 strings:**
- Start with capital letters and +/=
- No newlines in GitHub secret
- Example: `MIIKvgIBAzCCCn...==`

**JSON:**
- Valid JSON format
- No extra whitespace
- Example: `{"type":"service_account","project_id":"..."}`

**Passwords:**
- Plain text
- No special encoding
- Example: `my-secure-password-123`

### B. Minimum Permissions

**iOS:**
- App Manager role in App Store Connect
- Developer role in Apple Developer

**Android:**
- Release Manager role in Play Console
- Service Account User in GCP

### C. Certificate Validity

**iOS Distribution Certificate:**
- Valid for: 1 year
- Auto-renews via Fastlane Match
- Monitor expiration in Apple Developer portal

**Android Keystore:**
- Valid for: 10,000 days (~27 years)
- Does NOT auto-renew
- Must be backed up permanently

---

**Last Updated**: 2026-06-27  
**Version**: 1.0.0  
**Maintainer**: DevOps Team
