import { ServiceBusClient } from '@azure/service-bus';
import { getEnv } from './env';

let cachedClient: ServiceBusClient | undefined;

export function getQueueSender() {
  const env = getEnv();

  if (!cachedClient) {
    cachedClient = new ServiceBusClient(env.SERVICEBUS_CONNECTION);
  }

  const sender = cachedClient.createSender(env.SERVICEBUS_QUEUE_NAME);

  return sender;
}

export async function sendConsultMessage(messageBody: unknown) {
  const sender = getQueueSender();
  await sender.sendMessages({
    body: messageBody,
    contentType: 'application/json'
  });
}

export async function closeQueueClient() {
  if (cachedClient) {
    await cachedClient.close();
    cachedClient = undefined;
  }
}
