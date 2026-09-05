# Chrome Web Store release guide

This guide covers NAVI's first Chrome Web Store submission and later automatic
releases from `main`.

## Current safety rule

Do not add an OpenAI API key to GitHub Actions or to a public extension build.
WXT/Vite would place that key inside JavaScript that every user can inspect.
The production AI connection must use a backend or another design that does
not distribute a shared secret.

Google Workspace access already uses OAuth. The OAuth client ID in the
manifest is public configuration, not an API secret.

## What GitHub Actions does now

On every push to `main`, `.github/workflows/release.yml`:

1. Runs the typecheck and unit tests.
2. Creates a unique Chrome manifest version.
3. Builds and packages the extension with a non-secret marker that overrides
   any accidental dotenv value and becomes an empty runtime key.
4. Opens the ZIP and rejects a development-only manifest `key` or common
   embedded credential formats.
5. Saves the verified Chrome ZIP as a workflow artifact for 14 days.

Automatic Web Store submission remains off until the setup below is complete.
The `CWS_AUTO_PUBLISH` variable controls that final step.

## First submission checklist

1. Register the publisher account and declare the correct trader status.
2. In Publisher settings, add and verify a public contact email.
3. Enter the public publisher address required by Google.
4. Merge this release setup and download the Chrome ZIP from the completed
   **Chrome Web Store release** workflow.
5. In the Developer Dashboard, choose **New item** and upload the ZIP.
6. Complete the Store listing, Privacy, and Distribution tabs with the details
   below.
7. Test the uploaded draft before submitting it for review.
8. Submit the first version manually. Later updates can use the API workflow.

Use the ZIP from the merged workflow run. Do not upload the local test ZIP
with version `1.0.123.3`: its higher version would block later uploads from
the workflow until their version exceeds it.

Do not submit the first version until the production AI connection works
without an embedded shared API key.

## Listing details

### Product details

- Name: `NAVI`
- Category: `Productivity`
- Language: `English`
- Homepage: `https://github.com/navi-ai-forall/navi`
- Support email: `contactus.navi@gmail.com`
- Privacy policy:
  `https://github.com/navi-ai-forall/navi/blob/main/PRIVACY.md`

### Short description

> An accessible AI assistant for reading, understanding, and editing Google
> Sheets, Docs, and Slides by voice or text.

### Detailed description

> NAVI helps blind and visually impaired users work with Google Sheets, Docs,
> and Slides. Ask questions by voice or text, hear concise explanations, and
> make supported edits without navigating complex visual controls.
>
> NAVI includes keyboard shortcuts, screen-reader mode, adjustable speech and
> text settings, English and Bahasa Indonesia support, and optional wake-word
> activation.
>
> Data disclosure: To answer a request, NAVI sends the user's prompt and
> relevant content from the open Google file to OpenAI. If Whisper or the
> natural voice is selected, NAVI also sends microphone audio or response text
> to OpenAI for that requested feature. Google account data is used only to
> provide NAVI's user-facing features. NAVI does not sell user data or use it
> for advertising.

### Single purpose

> NAVI provides an accessible voice-and-text assistant that helps users
> understand and edit supported Google Workspace documents.

### Permission justifications

- `identity`: Requests the user's authorization for Google Workspace APIs.
- `identity.email`: Shows the active Google account in access troubleshooting.
- `storage`: Saves accessibility preferences and short-lived recent findings.
- Host access to `docs.google.com`: Runs NAVI only on supported Google Sheets,
  Docs, and Slides pages.
- Host access to Google Sheets, Docs, and Slides APIs: Reads or changes the
  file only after the user authorizes Google access and requests the feature.

## Store identifiers

- Publisher ID: `b41db488-cbd3-4852-aac1-4fcf0c65dfff`
- Current development extension ID: `fojpekkjeokfmckeohalgnmdjcdeejme`
- Web Store extension ID: record this after the first draft upload.

The public manifest key keeps the development ID stable. Builds with
`WXT_RELEASE_VERSION` set omit this field because the Web Store rejects it
on upload. Local unpacked builds keep it for Google OAuth. Release checks
inspect the extracted ZIP, not just the build directory.

Do not assume that the first Web Store item will have the development ID.
After uploading the draft, copy its item ID and public key from the Package
tab. If the IDs differ, update
the manifest public key and the Google OAuth client's extension ID to match
the Store item, then build and upload a new version before testing sign-in.
Use the Store item ID for deployment configuration. See
[Chrome's extension ID guide](https://developer.chrome.com/docs/extensions/reference/manifest/key).

## Automatic submission setup

The workflow uses Google Workload Identity Federation. It does not store a
long-lived Google service-account key in GitHub.

1. Create or select a Google Cloud project owned by the NAVI account.
2. Enable the Chrome Web Store API.
3. Create a service account for NAVI releases.
4. Create a Workload Identity Pool and GitHub OIDC provider restricted to the
   repository `navi-ai-forall/navi` and branch `main`.
5. Grant that GitHub identity `roles/iam.workloadIdentityUser` on the service
   account.
6. In Chrome Web Store Publisher settings, add the service account email.
7. In GitHub, create an environment named `chrome-web-store`. Require approval
   for deployments to this environment while the release is new.
8. In repository Settings > Secrets and variables > Actions > Variables,
   add the repository variable `CWS_AUTO_PUBLISH=false`. This variable must
   be at repository level because GitHub checks the publish job condition
   before environment variables are available.
9. Add these non-secret variables to the `chrome-web-store` environment:

   - `CWS_PUBLISHER_ID=b41db488-cbd3-4852-aac1-4fcf0c65dfff`
   - `CWS_EXTENSION_ID=<item ID from the Web Store draft>`
   - `GCP_SERVICE_ACCOUNT=<service account email>`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER=<full provider resource name>`

10. Run the workflow manually and confirm that the ZIP is produced. Manual
    runs only build a package; they do not submit it to the Store.
11. After the first manual Store submission and a successful production test,
    change the repository variable `CWS_AUTO_PUBLISH` to `true`.

See [GitHub's variable availability rules](https://docs.github.com/en/actions/reference/workflows-and-actions/variables#configuration-variable-precedence)
for the distinction between repository and environment variables.

With automatic publishing enabled, each merge to `main` uploads the new ZIP
and submits it for Chrome Web Store review. Google publishes it after approval
using the item's existing visibility settings.
