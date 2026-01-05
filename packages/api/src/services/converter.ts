import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';

// Configure ffmpeg path
console.log("FFmpeg Path from static:", ffmpegPath);
if (ffmpegPath) {
    ffmpeg.setFfmpegPath(ffmpegPath);
} else {
    console.warn("FFmpeg binary not found!");
}

export const convertToOgg = async (inputPath: string): Promise<string> => {
    if (!ffmpegPath) return inputPath; // Fallback if no ffmpeg

    const outputPath = inputPath.replace(/\.[^.]+$/, '.ogg'); // Change extension to .ogg

    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('ogg')
            .audioCodec('libopus')
            .on('end', async () => {
                console.log(`Conversion finished: ${outputPath}`);
                // Optional: Delete original? No, let the cleanup job handle it or caller.
                // But generally we want to return the new path and maybe delete the old one to save space?
                // For now, let's keep it simple.
                // Actually, unlink the original to act as a proper "filter"
                // try {
                //    await unlink(inputPath);
                // } catch(e) {}
                resolve(outputPath);
            })
            .on('error', (err) => {
                console.error('Conversion error: ', err);
                reject(err);
            })
            .save(outputPath);
    });
};
