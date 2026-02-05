import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { Readable, PassThrough } from 'stream';
import { getConsult } from '../lib/consultRepository';
import { createVoiceLiveSession, logToDebug } from '../lib/voiceliveclient';
import { SessionManager } from '../lib/voiceSessionManager';

export async function handler(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    const id = request.params?.id;
    logToDebug(`[VoiceListen] Handler invoked for consultId: ${id}`);
    context.log(`[VoiceListen] Handler invoked for consultId: ${id}`);
    if (!id) return { status: 400, jsonBody: { error: 'Missing consult id' } };


    // DEBUG: SIMPLE STREAM TEST (Standard Web API Pattern)
    if (id === 'debug-stream') {
        const stream = new ReadableStream({
            async start(controller) {
                // Send initial keep-alive
                controller.enqueue(new TextEncoder().encode(": keep-alive\n\n"));
                
                for (let i = 0; i < 10; i++) {
                    const msg = `data: {"count": ${i}, "ts": "${new Date().toISOString()}"}\n\n`;
                    controller.enqueue(new TextEncoder().encode(msg));
                    await new Promise(r => setTimeout(r, 500)); // 500ms delay
                }
                controller.close();
            }
        });

        return { 
            status: 200,
            headers: { 
                 'Content-Type': 'text/event-stream; charset=utf-8',
                 'Cache-Control': 'no-cache, no-transform',
                 'X-Accel-Buffering': 'no'
             },
            body: stream as any
        };
    }

    try {
        logToDebug(`[VoiceListen] Fetching consult ${id}...`);
        
        let consult;
        if (id === '0-0') {
             consult = {
                id: "0-0",
                convId: 0,
                msgId: 0,
                senderEmail: "admin@system.local",
                receivedAt: new Date().toISOString(),
                payload: {
                    msgId: 0, 
                    convId: 0,
                    created: Date.now(),
                    senderEmail: "admin@system.local",
                    msgType: "text",
                    msgText: "System Check"
                }
             };
        } else {
             consult = await getConsult(id);
        }

        if (!consult) {
            context.log(`[VoiceListen] Consult ${id} not found`);
            return { status: 404, jsonBody: { error: 'Consult not found' } };
        }

        // Connect to VoiceSession
        let hbInterval: NodeJS.Timeout;
        let flushInterval: NodeJS.Timeout;

        const stream = new ReadableStream({
            async start(controller) {
                // 0. Initial Open
                controller.enqueue(new TextEncoder().encode(": keep-alive\n\n"));

                // Buffering State
                let audioBuffer: Buffer = Buffer.alloc(0);
                const PREFERRED_CHUNK_SIZE = 4096; // ~85ms of audio (24kHz 16bit)

                const flushAudio = () => {
                     if (audioBuffer.length === 0) return;
                     try {
                        const b64 = audioBuffer.toString('base64');
                        const msg = `data: ${JSON.stringify({ t: 'audio', d: b64 })}\n\n`;
                        controller.enqueue(new TextEncoder().encode(msg));
                        audioBuffer = Buffer.alloc(0);
                     } catch (e) {
                         // Stream likely closed
                     }
                };

                // 1. Setup Heartbeat & Flush
                hbInterval = setInterval(() => {
                    try {
                        controller.enqueue(new TextEncoder().encode(": keep-alive\n\n"));
                    } catch (e) {
                         clearInterval(hbInterval);
                         clearInterval(flushInterval);
                    }
                }, 10000);

                flushInterval = setInterval(() => {
                    flushAudio();
                }, 150); // Flush any pending audio every 150ms if not filled

                try {
                     // 2. Setup Session
                     await SessionManager.remove(id); // Clean any stale session
                     
                     const ticket = SessionManager.reserve(id);
                     
                     const session = await createVoiceLiveSession(consult, {
                        onAudioData: (data) => {
                             try {
                                const chunk = Buffer.from(data);
                                audioBuffer = Buffer.concat([audioBuffer, chunk]);
                                
                                if (audioBuffer.length >= PREFERRED_CHUNK_SIZE) {
                                    flushAudio();
                                }
                             } catch (e) {
                                 context.warn(`[VoiceListen] Error buffering audio: ${e}`);
                             }
                        },
                        onInputStarted: () => {
                             try {
                                // Flush anything pending first? 
                                // No, usually we want to clear.
                                audioBuffer = Buffer.alloc(0); // CLEAR BUFFER
                                const msg = `data: ${JSON.stringify({ t: 'clear' })}\n\n`;
                                controller.enqueue(new TextEncoder().encode(msg));
                             } catch (e) { /* ignore */ }
                        }
                     });

                     SessionManager.register(id, session, ticket); // Pass ticket to prevent race conditions
                     
                     // Attach controller to session manager to allow external closing
                     SessionManager.attachController(id, controller);

                     // 3. Send Ready
                     controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ t: 'ready' })}\n\n`));

                } catch (err: any) {
                    context.error(`[VoiceListen] Setup failed: ${err}`);
                    controller.error(err);
                    clearInterval(hbInterval);
                }
            },
            cancel() {
                context.log(`[VoiceListen] Stream cancelled for ${id}`);
                clearInterval(hbInterval);
                clearInterval(flushInterval);
                SessionManager.remove(id).catch(e => context.error(e));
            }
        });

        return {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'X-Accel-Buffering': 'no'
            },
            body: stream as any
        };

    } catch (error: any) {
        logToDebug(`[VoiceListen] CRITICAL ERROR for ${id}: ${error.message} \nStack: ${error.stack}`);
        context.error(`[VoiceListen] Error ${id}`, error);
        return { status: 500, jsonBody: { error: 'Internal server error' } };
    }
}

app.http('consult-voice-listen', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'consults/{id}/voice-listen',
    handler
});
