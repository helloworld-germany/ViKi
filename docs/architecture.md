# Virtual Pediatric Clinic MVP Architecture

## Channels
- **NetSfere** provides the secure asynchronous ingress point. Each bot identity (e.g., `botdo@sweethomeonline.de`) registers a webhook that forwards payload metadata to the Azure backend.
- Future channels (Teams, FHIR inbox, phone transcription) can emit into the same Service Bus topic with channel-specific adapters.

## Azure Components
1. **Azure Functions (Consumption)**
   - `netsfere-webhook` HTTP trigger for webhook callbacks.
   - Optional timers/pollers ensure message reliability if webhooks fail.
   - Publishes normalized consult events into Service Bus.
2. **Service Bus**
   - `consult-ingress` queue decouples channel ingestion from specialist workflows.
3. **Processing Workers (future)**
   - Container Apps or additional Functions subscribe to the queue, perform AI enrichment (Vision + GPT), validate specialist-specific requirements, and drop curated consult packages into Storage/Cosmos.
4. **Key Vault**
   - Stores channel credentials, webhook secrets, and API keys.
5. **Storage + App Insights**
   - Storage provides Function state + blob payload storage for attachments.
   - Application Insights centralizes telemetry and end-to-end tracing.

## Specialist Portal
- Next.js frontend today consumes mock data (see `frontend/portal/lib/mockData.ts`).
- Planned API: REST or GraphQL endpoint that streams consult packages, attachments (SAS URLs), and AI reasoning traces.
- Voice surface integrates Azure Speech SDK + GPT to provide hands-free summaries and clarifications.

## Identity & Data Flow
1. Hospital physician sends consult through NetSfere.
2. NetSfere webhook → Azure Functions fetches full message/attachments.
3. Message packaged + pushed to Service Bus.
4. Processing service enforces specialist checklists, obtains missing info, or escalates emergency overrides.
5. Once complete, consult is exposed via API + stored in specialist-owned destination (SharePoint, S3, etc.).
6. Specialist portal surfaces summary, attachments, and conversational interface for documentation.
