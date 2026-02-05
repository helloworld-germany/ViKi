# Backend

Azure Functions codebase that ingests NetSfere consults and forwards them to downstream processing components.

## Structure

- `functions/src/functions/netsfereWebhook.ts` — HTTP endpoint registered as the NetSfere webhook target.
- `functions/src/lib` — shared utilities (environment validation, NetSfere API client, Service Bus helpers).

## Local Development

1. Install dependencies:
   ```
   cd backend/functions
   npm install
   ```
2. Run the build to emit JavaScript into `dist/`:
   ```
   npm run build
   ```
3. Start the Azure Functions host:
   ```
   npm start
   ```
4. Use a tool like `curl` to POST sample webhook payloads:
   In Bash:
   ```bash
   curl -X POST http://localhost:7071/api/netsfere/webhook \
     -H "Content-Type: application/json" \
     -d '{"convId":27848,"msgId":212619,"senderEmail":"physician@example.com"}'
   ```
   
   Use the following example to retrieval the last message send to the bot. Both the `convId` and `msgId` are set to `0`, so that all the conversation and message are retrieved for the bot user.
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:7071/api/netsfere/webhook" `
     -Method Post `
     -Headers @{ "Content-Type" = "application/json" } `
     -Body '{"convId":0,"msgId":0}'
   ```
   The "senderEmail" must be the user email you want to fetch msg or ignore it.

> Ensure `local.settings.json` contains temporary NetSfere credentials, Azure Storage, and the Azure Voice Live keys described below for local testing only.

### Voice Live configuration

Create an Azure Voice Live project/agent in the Microsoft Foundry portal, then set these values in `backend/functions/local.settings.json` (or in your Function App settings):

| Setting | Description |
| --- | --- |
| `AZURE_VOICELIVE_ENDPOINT` | Voice Live endpoint URI from the Foundry project (for example `https://<project>.services.ai.azure.com`). |
| `AZURE_VOICELIVE_API_VERSION` | API version to call, e.g. `2025-10-01`. |
| `AZURE_VOICELIVE_MODEL` | Voice Live model such as `gpt-realtime` or `gpt-realtime-mini`. |
| `AZURE_VOICELIVE_VOICE` | Azure Speech voice to render responses (for example `en-US-Ava:DragonHDLatestNeural`). |
| `AZURE_VOICELIVE_PROJECT_NAME` | Foundry project name tied to the Voice Live resource. |
| `AZURE_VOICELIVE_SCOPE` | Optional override for the Entra scope (defaults to `https://voicelive.azure.com/.default`). |
| `AZURE_VOICELIVE_AGENT_ID` | Optional agent identifier if you are connecting through a Voice Live agent instead of a raw model. |
| `AZURE_VOICELIVE_API_KEY` | Optional API key fallback. The Functions app prefers Managed Identity/DefaultAzureCredential in production. |
| `AZURE_CLI_PATH` | Optional path to the Azure CLI executable if `az` is not on your `PATH`. |

These values allow the `/api/consults/{id}/voice-ticket` endpoint to mint short-lived Voice Live sessions (using Microsoft Entra tokens) that include the originating NetSfere consult context.

> **Local auth tip:** When no API key is provided, the Function first tries `DefaultAzureCredential` and then automatically shells out to `az account get-access-token --scope https://voicelive.azure.com/.default`. Make sure the Azure CLI is installed, run `az login` in the same terminal before `npm start`, and set `AZURE_CLI_PATH` if the `az` command lives elsewhere.

## netsfere client sample
```powershell
$body = @{
    email    = "botdo@xxxx"
    password = "xxxxx"
    convId    = "0"
    msgId    = "0"
}

Invoke-RestMethod -Uri "https://api.netsfere.com/get" `
    -Method Post `
    -Body $body
```
Note:`
* use `web.netsfere.com` to see the convID from the webbrowser, or use `convId="0"` and `msgId="0"` to get all the messages for the user with given email.  

## Verifying the NetSfere ingest path

1. **Probe the API** — Post the identifiers you want to test to `http://localhost:7071/api/netsfere/pull`:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:7071/api/netsfere/pull" -Method Post -Body '{"convId":27848,"msgId":212619}' -ContentType 'application/json'
   ```
   A `200` response confirms the configured credentials can read from NetSfere.
2. **Store the consult** — Send the same payload to `/api/netsfere/webhook` to trigger persistence in Blob Storage.
3. **List results** — Call `/api/consults` (or `/api/consults/{id}`) to confirm the consult appears in the portal feed.

Repeat as needed while Azurite + the Functions host are running locally (`npm start`).

