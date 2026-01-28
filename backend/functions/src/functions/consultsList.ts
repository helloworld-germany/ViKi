import { app, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listConsults } from '../lib/consultRepository';

async function handler(_: unknown, context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const consults = await listConsults();
    return {
      status: 200,
      jsonBody: consults
    };
  } catch (error) {
    context.error('Failed to list consults', error);
    return {
      status: 500,
      jsonBody: { error: 'Unable to list consults' }
    };
  }
}

app.http('consults-list', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'consults',
  handler
});
