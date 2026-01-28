@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Short environment name such as dev, test, or prod')
param environment string = 'dev'

@description('Lowercase prefix used when generating unique resource names')
param namePrefix string = 'viki'

@description('Object ID of the principal that should administer Key Vault and Function App secrets')
param deployerObjectId string

@description('NetSfere bot email (stored as a secret)')
@secure()
param netsfereEmail string

@description('NetSfere bot password (stored as a secret)')
@secure()
param netsferePassword string

@description('NetSfere organization identifier (stored as a secret)')
@secure()
param netsfereOrgId string

@description('NetSfere authorization key (stored as a secret)')
@secure()
param netsfereAuthKey string

@description('Azure OpenAI resource name (without https:// prefix)')
param openAiResourceName string

@description('Azure OpenAI deployment name for GPT Realtime model')
param openAiRealtimeDeployment string

@description('Azure OpenAI API key')
@secure()
param openAiApiKey string

@description('Azure OpenAI API version for realtime endpoint')
param openAiApiVersion string = '2025-04-01-preview'

@description('Preferred Azure OpenAI voice profile')
param openAiVoice string = 'alloy'

var uniqueSuffix = toLower(uniqueString(resourceGroup().id, environment, namePrefix))
var storageAccountName = take(replace('${namePrefix}${environment}${uniqueSuffix}', '-', ''), 24)
var functionAppName = '${namePrefix}-${environment}-func'
var keyVaultName = take('${namePrefix}-${environment}-kv-${uniqueSuffix}', 24)
var appInsightsName = '${namePrefix}-${environment}-ai'
var keyVaultUri = 'https://${keyVaultName}.vault.azure.net/'
var consultContainerName = 'consults'
var attachmentContainerName = 'consult-attachments'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

resource consultContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/${consultContainerName}'
  properties: {
    publicAccess: 'None'
  }
}

resource attachmentContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  name: '${storageAccount.name}/default/${attachmentContainerName}'
  properties: {
    publicAccess: 'None'
  }
}

resource hostingPlan 'Microsoft.Web/serverfarms@2022-03-01' = {
  name: '${namePrefix}-${environment}-plan'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  kind: 'functionapp'
  properties: {
    reserved: true
  }
}

resource functionApp 'Microsoft.Web/sites@2022-03-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|18'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=${environment().suffixes.storage}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'KEY_VAULT_URI'
          value: keyVaultUri
        }
        {
          name: 'NETSFERE_EMAIL'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/netsfere-email)'
        }
        {
          name: 'NETSFERE_PASSWORD'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/netsfere-password)'
        }
        {
          name: 'NETSFERE_ORG_ID'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/netsfere-org-id)'
        }
        {
          name: 'NETSFERE_AUTH_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/netsfere-auth-key)'
        }
        {
          name: 'CONSULT_CONTAINER'
          value: consultContainerName
        }
        {
          name: 'ATTACHMENT_CONTAINER'
          value: attachmentContainerName
        }
        {
          name: 'OPENAI_RESOURCE_NAME'
          value: openAiResourceName
        }
        {
          name: 'OPENAI_REALTIME_DEPLOYMENT'
          value: openAiRealtimeDeployment
        }
        {
          name: 'OPENAI_API_VERSION'
          value: openAiApiVersion
        }
        {
          name: 'OPENAI_VOICE'
          value: openAiVoice
        }
        {
          name: 'OPENAI_API_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/openai-api-key)'
        }
      ]
    }
  }
  dependsOn: [
    storageAccount
    hostingPlan
  ]
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: deployerObjectId
        permissions: {
          secrets: [
            'get'
            'list'
            'set'
            'delete'
          ]
        }
      }
      {
        tenantId: subscription().tenantId
        objectId: functionApp.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    enablePurgeProtection: false
  }
}

resource netsfereEmailSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: '${keyVault.name}/netsfere-email'
  properties: {
    value: netsfereEmail
  }
}

resource netsferePasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: '${keyVault.name}/netsfere-password'
  properties: {
    value: netsferePassword
  }
}

resource netsfereOrgIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: '${keyVault.name}/netsfere-org-id'
  properties: {
    value: netsfereOrgId
  }
}

resource netsfereAuthKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: '${keyVault.name}/netsfere-auth-key'
  properties: {
    value: netsfereAuthKey
  }
}

resource openAiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: '${keyVault.name}/openai-api-key'
  properties: {
    value: openAiApiKey
  }
}

output functionAppName string = functionApp.name
output keyVaultUri string = keyVaultUri
