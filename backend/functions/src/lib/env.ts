import { z } from 'zod';

const envSchema = z.object({
  NETSFERE_EMAIL: z.string().email(),
  NETSFERE_PASSWORD: z.string().min(8),
  NETSFERE_ORG_ID: z.string().min(1),
  NETSFERE_AUTH_KEY: z.string().min(1),
  NETSFERE_POLL_ENABLED: z.enum(['true', 'false']).optional(),
  AzureWebJobsStorage: z.string().min(1),
  CONSULT_CONTAINER: z.string().min(1),
  ATTACHMENT_CONTAINER: z.string().min(1),
  AZURE_VOICELIVE_ENDPOINT: z.string().url(),
  AZURE_VOICELIVE_API_VERSION: z.string().min(1),
  AZURE_VOICELIVE_MODEL: z.string().min(1),
  AZURE_VOICELIVE_VOICE: z.string().min(1),
  AZURE_VOICELIVE_API_KEY: z.string().min(1).optional(),
  AZURE_VOICELIVE_SCOPE: z.string().min(1).optional(),
  AZURE_VOICELIVE_PROJECT_NAME: z.string().min(1),
  AZURE_VOICELIVE_AGENT_ID: z.string().min(1).optional(),
  AZURE_LOCATION: z.string().min(1).optional(),
  AZURE_ENV_NAME: z.string().min(1).optional(),
  AZURE_SUBSCRIPTION_ID: z.string().min(1).optional()
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | undefined;

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}
