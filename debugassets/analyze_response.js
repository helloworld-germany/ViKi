const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || path.join(__dirname, 'debug_response.pcm');

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

try {
    const buffer = fs.readFileSync(filePath);
    // Assuming 16-bit little-endian mono
    const int16 = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);
    
    let min = 32767;
    let max = -32768;
    let sumSq = 0;
    let clipCount = 0;
    let zeroCount = 0;
    
    for(let i=0; i<int16.length; i++) {
        const val = int16[i];
        if (val < min) min = val;
        if (val > max) max = val;
        sumSq += val * val;

        if (val >= 32767 || val <= -32768) {
            clipCount++;
        }
        if (val === 0) {
            zeroCount++;
        }
    }
    
    const rms = Math.sqrt(sumSq / int16.length);
    const durationSec = int16.length / 24000; // Assuming 24kHz
    
    console.log(`Analyzing ${path.basename(filePath)}`);
    console.log(`Size: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`Samples: ${int16.length}`);
    console.log(`Duration (est 24kHz): ${durationSec.toFixed(2)}s`);
    console.log(`Min: ${min}`);
    console.log(`Max: ${max}`);
    console.log(`RMS: ${rms.toFixed(2)}`);
    console.log(`Clipped Samples: ${clipCount} (${(clipCount/int16.length*100).toFixed(2)}%)`);
    console.log(`Zero Samples: ${zeroCount} (${(zeroCount/int16.length*100).toFixed(2)}%)`);

    if (clipCount > 0) {
        console.warn("\nWARNING: CLIPPING DETECTED! The audio is hitting the maximum range.");
    }
    
    if (rms > 5000) {
        console.warn("WARNING: High volume (LOUD).");
    } else if (rms < 100) {
        console.warn("WARNING: Audio is very quiet (Silence).");
    }

} catch (err) {
    console.error("Error analyzing file:", err);
}
