import { VoiceLiveSession } from '@azure/ai-voicelive';

interface SessionBase {
    consultId: string;
    lastActivity: number;
}

interface ActiveSession extends SessionBase {
    type: 'active';
    session: VoiceLiveSession;
    outputController: ReadableStreamDefaultController<any> | null;
}

interface PendingSession extends SessionBase {
    type: 'pending';
}

type SessionEntry = ActiveSession | PendingSession;

// In-memory store for local development MVP
// accessible by all function invocations in the same process
const sessions = new Map<string, SessionEntry>();

export const SessionManager = {
    listKeys: () => Array.from(sessions.keys()),
    
    // Reserve a slot. Returns a 'ticket' to be used for registration.
    reserve: (consultId: string): PendingSession => {
        console.log(`[SessionManager] Reserving session slot for ${consultId}`);
        const entry: PendingSession = {
            type: 'pending',
            consultId,
            lastActivity: Date.now()
        };
        sessions.set(consultId, entry);
        return entry;
    },

    register: (consultId: string, session: VoiceLiveSession, ticket?: any) => {
        // Ticket is required to prevent race conditions
        const current = sessions.get(consultId);
        
        // If ticket provided (new way), verify ownership
        if (ticket && current !== ticket) {
             console.log(`[SessionManager] Register failed for ${consultId}: Slot takeover detected. Disposing new session.`);
             session.dispose().catch(e => console.error(e));
             return;
        }
        
        // If no ticket (legacy/fallback), just force overwrite (dangerous but compatible)
        if (!ticket && current && current.type === 'active') {
             console.warn(`[SessionManager] Force overwriting active session for ${consultId} (No ticket provided)`);
        }

        const activeEntry: ActiveSession = {
            type: 'active',
            consultId,
            session,
            outputController: null,
            lastActivity: Date.now()
        };
        
        sessions.set(consultId, activeEntry);
        console.log(`[SessionManager] Registered active session for ${consultId}`);
    },

    get: (consultId: string) => {
        const s = sessions.get(consultId);
        if (s) s.lastActivity = Date.now();
        if (s && s.type === 'active') return s as ActiveSession;
        return undefined;
    },

    waitForSession: async (consultId: string, timeoutMs: number = 5000): Promise<ActiveSession | undefined> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const s = sessions.get(consultId);
            if (s && s.type === 'active') {
                s.lastActivity = Date.now();
                return s as ActiveSession;
            }
            if (!s) {
                 // Should we wait if it's completely missing? Maybe it hasn't even reserved yet?
                 // For now, let's assume if it's missing, we wait a bit in case reserve is just about to happen.
            }
            // Wait 100ms
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return undefined;
    },

    remove: async (consultId: string) => {
        const s = sessions.get(consultId);
        if (s) {
            console.log(`[SessionManager] Preventing/Removing session for ${consultId} (Type: ${s.type})`);
            sessions.delete(consultId);
            
            if (s.type === 'active') {
                try {
                    // If we have an active controller, close it to end the GET stream
                    if (s.outputController) {
                        try { 
                            console.log(`[SessionManager] Closing output controller for ${consultId}`);
                            s.outputController.close(); 
                        } catch (e) { 
                            console.log(`[SessionManager] Error closing controller: ${e}`);
                        }
                    }
                    console.log(`[SessionManager] Disposing VoiceLive session for ${consultId}`);
                    await s.session.dispose();
                    console.log(`[SessionManager] Disposed VoiceLive session for ${consultId}`);
                } catch (e) {
                    console.error(`[SessionManager] Error disposing session ${consultId}`, e);
                }
            }
        } else {
            console.log(`[SessionManager] No session found to remove for ${consultId}`);
        }
    },

    attachController: (consultId: string, controller: ReadableStreamDefaultController<any>) => {
        const s = sessions.get(consultId);
        if (s && s.type === 'active') {
             (s as ActiveSession).outputController = controller;
             console.log(`[SessionManager] Controller attached to ${consultId}`);
        }
    },

    detachController: (consultId: string) => {
        const s = sessions.get(consultId);
        if (s && s.type === 'active') {
            (s as ActiveSession).outputController = null;
            console.log(`[SessionManager] Controller detached from ${consultId}`);
        }
    }
};
