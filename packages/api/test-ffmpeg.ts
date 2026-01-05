import ffmpeg from 'ffmpeg-static';
console.log("FFmpeg Static Path:", ffmpeg);
import { existsSync } from 'node:fs';
if (ffmpeg && existsSync(ffmpeg)) {
    console.log("Binary exists at path.");
} else {
    console.log("Binary NOT found at path.");
}
