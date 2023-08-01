import {
    connect,
    NatsConnection,
    StringCodec,
    JSONCodec
} from "nats";
import fs from "fs";
import * as wav from "node-wav";

const wavFilePath = './benchmark/converted_float32.wav';

async function makeRequest(audioData: Float32Array): Promise<number> {
    const nc: NatsConnection = await connect({
        servers: "localhost:4222",
        user: "nlu",
        pass: "password"
    });
    const jc = JSONCodec();

    // Start the timer
    const startTime = performance.now();

    // Make the nc.request
    const sttRes = await nc.request("service.stt", jc.encode(audioData), {
        timeout: 60000
    });

    // Stop the timer and calculate the elapsed time
    const endTime = performance.now();
    const elapsedTime = endTime - startTime;
    return elapsedTime;
}

async function main() {
    const sc = StringCodec();
    const wavData = fs.readFileSync(wavFilePath);

    // Decode the WAV data using node-wav
    const decodedWav = wav.decode(wavData);
    const audioData = decodedWav.channelData[0]; // Assuming mono audio (channel 0)

    const numRequests = 20;
    const requestPromises: Promise<number>[] = [];

    for (let i = 0; i < numRequests; i++) {
        requestPromises.push(makeRequest(audioData));
    }

    // Run all requests concurrently and collect the results
    const requestTimes = await Promise.all(requestPromises);

    for (let i = 0; i < numRequests; i++) {
        console.log(`Request ${i + 1} took ${requestTimes[i]} milliseconds`);
    }

    // Calculate statistics
    const minTime = Math.min(...requestTimes);
    const maxTime = Math.max(...requestTimes);
    const totalElapsedTime = requestTimes.reduce((acc, time) => acc + time, 0);
    const medianTime = requestTimes[Math.floor(requestTimes.length / 2)];

    console.log("Minimum time:", minTime, "milliseconds");
    console.log("Maximum time:", maxTime, "milliseconds");
    console.log("Median time:", medianTime, "milliseconds");
    console.log("Average time:", totalElapsedTime / numRequests, "milliseconds");
}

main().catch((err) => {
    console.error("Error:", err);
});
