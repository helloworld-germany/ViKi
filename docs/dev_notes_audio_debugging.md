# Developer Notes: Audio Debugging & Session Stability
**Date:** February 5, 2026

## Overview
This document summarizes the debugging session regarding "multiple stream overload" audio artifacts, session stability race conditions, and frontend audio playback issues in the Voice Console.

## 1. Session Race Condition
**Issue:**
When a client requested a session (via `consultVoiceListen`), a concurrent request (e.g., from the browser or a retry) could overwrite the session in `VoiceSessionManager` before the first one finished initialization. This resulted in "Session ID mismatch" or "Session not found" errors.

**Fix:**
Implemented a "Reservation" pattern in `VoiceSessionManager.ts`:
1.  `reserve(id)`: Places a placeholder promise in the map immediately.
2.  `waitForSession(id)`: New requests wait for the promise to resolve instead of failing or creating a new one.
3.  `register(id, session, ticket)`: logic ensures only the reservation holder can complete the setup.

## 2. Audio "Overload" & Echo
**Symptoms:**
User reported "multiple stream overload", echoes, and audio continuing to play over itself.

**Analysis:**
-   PCM dumping (`debug_response.pcm`) proved the backend/Azure audio was clean (no clipping).
-   The issue was in the Frontend `VoiceConsole.tsx` drift correction logic.

**Root Cause:**
When the audio player detected latency (drift), it reset `nextStartTime` to `ctx.currentTime` to "catch up". However, it **did not stop the previously scheduled audio nodes**. This caused the "stale" audio (still in the buffer) and the "new" catch-up audio to play simultaneously.

**Fix:**
-   Added logic to **flush** (stop) all active audio nodes (`activeSourcesRef`) whenever a major drift correction (> 2.0s) occurs.

## 3. "Chunked" / "Cut Off" / "Too Fast" Audio
**Symptoms:**
Audio playback felt "choppy", the beginning of sentences was cut off, and speech sounded rushed.

**Root Cause:**
-   **Underrun:** The player was trying to play chunks *immediately* at `ctx.currentTime`. Due to network jitter, if a chunk arrived 10ms late, the player had already moved past the scheduled time.
-   **Aggressive Catch-up:** The drift logic was resetting to `now` immediately on underrun, providing zero buffer for the next chunk.

**Fix:**
-   Implemented a **Jitter Buffer** of **0.5 seconds**.
-   When an underrun is detected (player runs dry), the next chunk is scheduled for `now + 0.5s`. This ensures smooth playback even with network variance.
-   **Validation (Feb 05 2026):** Verified via "Echo Mode" test. User confirmed crystal clear audio loopback, proving the 0.5s Jitter Buffer and Frontend pipeline are working correctly.

## 4. Visualization (Green Bar) Unresponsive
**Symptoms:**
The green "Incoming" volume bar was barely moving.

**Root Cause:**
-   The previous implementation calculated volume based on the raw network packet.
-   This was decoupled from the actual playback time (especially with the new jitter buffer).
-   The gain was too low for the visualization.

**Fix:**
-   Switched to `WebAudio AnalyserNode`.
-   Connected the audio graph: `Source -> Analyser -> Destination`.
-   Added a dedicated `VISUAL_GAIN` (x50) to boost the visual bar sensitivity without affecting audio volume.
-   Implemented `requestAnimationFrame` to sample the analyser in real-time sync with what the user hears.

## 5. Stream Disconnection (One-Turn limit)
**Symptoms:**
After the first AI response, no further audio would play.

**Root Cause:**
`VoiceConsole.tsx` was calling `cleanup()` (destroying the entire AudioContext and Session) immediately upon any break in the `fetch` stream loop. If the stream paused or ended naturally, it killed the client.

**Fix:**
-   Removed aggressive `cleanup()` from the stream reader exit point.
-   Added error logging instead of session destruction.

## 6. Tooling Improvements
-   **`recompile.ps1`**: New script to automate full-stack (`backend` + `frontend`) builds.
-   **PCM Debugging**: `debugassets/analyze_response.js` created to inspect raw PCM files for clipping/silence.
-   **Instrumentation**: `voiceliveclient.ts` modified to dump `debug_response.pcm`.
