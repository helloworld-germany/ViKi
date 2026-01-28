# Infrastructure

This folder contains the Azure-native Bicep templates that provision the core resources for the Virtual Pediatric Clinic MVP.

## Resources

- Storage account for Azure Functions and raw consult payloads.
- Application Insights instance for telemetry.
- Service Bus namespace with the `consult-ingress` queue that buffers processed NetSfere payloads.
- Linux Consumption Function App (Node 18) that hosts the inbound webhook/poller logic.
- Key Vault storing NetSfere credentials and future integration secrets.

## Deployment

```
az deployment group create \
  --resource-group <rg-name> \
  --template-file infra/main.bicep \
  --parameters \
      environment=dev \
      namePrefix=viki \
      deployerObjectId=<azure-ad-object-id> \
      netsfereEmail=<bot-email> \
      netsferePassword=<bot-password> \
      netsfereOrgId=<org-id> \
      netsfereAuthKey=<auth-key>
```

> Replace placeholder parameters with the actual secure values. For production, source them from Azure DevOps/Azure Pipeline secret variables rather than inline CLI parameters.
