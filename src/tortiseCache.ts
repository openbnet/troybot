import {
    connect,
    NatsConnection,
    StringCodec,
    JSONCodec
} from "nats";
import fs from "fs";
import http from "http"
import { keccak256 } from "@ethersproject/keccak256";

const sc = StringCodec();
const jc = JSONCodec();
const CACHE_FOLDER = "./cache/";
async function main() {
    const nc: NatsConnection = await connect({
        servers: "nats_local:4222",
        user: "tortise_tts",
        pass: "password"
    });
    console.log("got nc")
    const subj = "service.tortise";
    const sub = await nc.subscribe(subj);
    (async () => {
        for await (const m of sub) {
            console.log("m reply", m.reply);
            const msg = sc.decode(m.data)
            console.log("msg", msg)
            const cachedFilePath = getCachedFilePath(msg);
            console.log("cachedFilePath", cachedFilePath)
            if (fs.existsSync(cachedFilePath)) {
                const cachedAudio = fs.readFileSync(cachedFilePath).toString("base64");
                await m.respond(sc.encode(cachedAudio));
            } else {
                const remoteAudioPath = await getTortiseTTS(msg);

                // Download audio from remote URL
                const file = fs.createWriteStream(cachedFilePath);
                http.get(remoteAudioPath, function (response) {
                    response.pipe(file);

                    // after download completed close filestream
                    file.on("finish", async () => {
                        file.close();
                        console.log("Download Completed");
                        await m.respond(sc.encode(fs.readFileSync(cachedFilePath).toString("base64")));
                    });
                });


            }
        }
    })();
}
async function run() {
    await main();

}

run();

function getCachedFilePath(msg: string) {
    const hashedMsg = keccak256(sc.encode(msg))
    console.log("hashedMsg", hashedMsg)
    return `${CACHE_FOLDER}${hashedMsg}.wav`;
}
async function getTortiseTTS(msg: string) {
    const url = "http://tortise-tts:7680";
    try {
        const response = await fetch(url + "/run/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                data: [
                    msg, // Input prompt
                    "\n", // Line delimiter
                    "Custom", // Emotion
                    "", // Custom emotion (empty for now)
                    "ruru", // Voice
                    null, // Microphone source (not used)
                    0, // Voice chunks
                    1, // Candidates
                    0, // Seed
                    2, // Samples
                    32, // Iterations
                    0.9, // Temperature
                    "P", // Diffusion Samplers
                    15, // Pause Size
                    0, // CVVP Weight
                    0.8, // Top P
                    1, // Diffusion Temperature
                    1, // Length Penalty
                    2, // Repetition Penalty
                    2, // Conditioning-Free K
                    ["Half Precision"], // Experimental Flags
                    false, // Use Original Latents Method (AR)
                    false // Use Original Latents Method (Diffusion)
                ]
            })
        })
            .then((res) => res.json())
            .catch((err) => {
                console.error("tts generate err", err);
                throw new Error("TTS error");
            });
        console.log("tts res", response);
        // Get the audio file from the response
        const audioData = response.data.find(
            (item: any) => item.is_file && item.name.endsWith(".wav")
        );
        if (!audioData) {
            throw new Error("Failed to get TTS audio");
        }
        return url + "/file=" + audioData.name;
    } catch (error) {
        console.error("TTS error", error);
        throw new Error("Failed to request TTS");
    }
}