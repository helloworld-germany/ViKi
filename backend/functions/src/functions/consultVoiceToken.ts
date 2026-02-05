import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getConsult } from '../lib/consultRepository';
import { createVoiceLiveTicket } from '../lib/voiceLiveClient';

async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  const id = request.params?.id;

  if (!id) {
    return {
      status: 400,
      jsonBody: { error: 'Missing consult id' }
    };
  }

  try {
    const consult = await getConsult(id);
    if (!consult) {
      return {
        status: 404,
        jsonBody: { error: 'Consult not found' }
      };
    }

    const ticket = await createVoiceLiveTicket(consult);

    return {
      status: 200,
      jsonBody: ticket
    };
  } catch (error) {
    context.error(`Failed to issue Voice Live ticket for consult ${id}`, error);
    return {
      status: 500,
      jsonBody: { error: 'Unable to create Voice Live ticket' }
    };
  }
}

app.http('consult-voice-ticket', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'consults/{id}/voice-ticket',
  handler
});
