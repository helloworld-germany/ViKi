// PCM Player Worklet for robust playback
// Based on ring buffer implementation to decouple network/main thread jitter from audio rendering

class PcmPlayer extends AudioWorkletProcessor {
    constructor() {
      super();
      this.queue = [];
      this.started = false;
      this.frameCount = 0;
      this.totalSamplesPlayed = 0;

      this.port.onmessage = (e) => {
        if (e.data.cmd === 'start') {
            this.started = true;
            this.port.postMessage({ type: 'debug', msg: 'CMD:Start received. Playing.' });
        } else if (e.data.cmd === 'stop') {
            this.started = false;
            this.queue = [];
            this.totalSamplesPlayed = 0;
            this.port.postMessage({ type: 'debug', msg: 'CMD:Stop received. Queue cleared.' });
        } else if (e.data instanceof Float32Array) {
            this.queue.push(e.data);
            // Log every 10th chunk received
            if (this.queue.length % 10 === 1) {
                this.port.postMessage({ type: 'debug', msg: `Chunk received. QueueSize=${this.queue.length}` });
            }
        }
      };
    }
  
    process(inputs, outputs, parameters) {
      const output = outputs[0];
      if (!output || !output[0]) return true;
      
      const channel = output[0];
      this.frameCount++;
      
      // Heartbeat: Log every 500 frames (~10 seconds at 128 samples/frame @ 24kHz)
      if (this.frameCount % 500 === 0) {
          this.port.postMessage({ type: 'heartbeat', frame: this.frameCount, queueSize: this.queue.length, started: this.started, played: this.totalSamplesPlayed });
      }
      
      // If not started or empty, output silence
      if (!this.started || this.queue.length === 0) {
          channel.fill(0);
          return true;
      }
  
      let offset = 0;
      while (offset < channel.length && this.queue.length > 0) {
          const chunk = this.queue[0];
          const remainingInChunk = chunk.length;
          const spaceInOutput = channel.length - offset;
          const toCopy = Math.min(remainingInChunk, spaceInOutput);
          
          // Copy samples
          channel.set(chunk.subarray(0, toCopy), offset);
          offset += toCopy;
          
          if (toCopy < remainingInChunk) {
              // We only consumed part of the chunk
              this.queue[0] = chunk.subarray(toCopy);
          } else {
              // We consumed the whole chunk
              this.queue.shift();
          }
      }
      
      // Track samples played
      this.totalSamplesPlayed += offset;
      
      // If we ran out of data mid-frame, fill rest with silence
      if (offset < channel.length) {
          channel.fill(0, offset);
      }
      
      return true;
    }
  }
  
  registerProcessor('pcm-player', PcmPlayer);
