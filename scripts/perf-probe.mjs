import { verlux } from '../dist/esm/index.js';

const samples = [
  'hello world this is a clean sentence with several words and no profanity at all',
  'fuck you stupid asshole what the hell are you doing here you idiot',
  'the assistant analyzed the classic peninsula and saw a peacock in the canal',
  'go fuck yourself you absolute moron and take your bullshit elsewhere',
  'I would like to schedule a meeting tomorrow afternoon to discuss the project',
];

// Warmup
for (let i = 0; i < 200; i++) for (const s of samples) verlux.detect(s);

// Measure
const N = 2000;
const start = process.hrtime.bigint();
for (let i = 0; i < N; i++) for (const s of samples) verlux.detect(s);
const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
const totalOps = N * samples.length;
console.log(`Total ops: ${totalOps}`);
console.log(`Elapsed: ${elapsedMs.toFixed(1)} ms`);
console.log(`Throughput: ${(totalOps / (elapsedMs / 1000)).toFixed(0)} ops/sec`);
console.log(`Avg latency: ${(elapsedMs / totalOps * 1000).toFixed(2)} us/op`);
