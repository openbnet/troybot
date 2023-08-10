import {
    connect,
    NatsConnection,
    StringCodec,
    JSONCodec
} from "nats";

const sc = StringCodec();
const jc = JSONCodec();

async function main() {
    const nc: NatsConnection = await connect({
        servers: "localhost:4222",
        user: "tortise_tts",
        pass: "password"
    });
    console.log("got nc")
    const subj = "service.tortise";
    const sub = await nc.subscribe(subj);
    (async () => {
        for await (const m of sub) {
            console.log("m reply", m.reply);
            await m.respond(
                sc.encode("ok")
            );
        }
    })();
}
async function run() {
    await main();

}

run();


async function getTortiseTTS(msg: string) {
    const url = "http://tts-tortise:7680";
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
        console.log("got audioData", audioData);
        return url + "/file=" + audioData.name;
    } catch (error) {
        console.error("TTS error", error);
        throw new Error("Failed to request TTS");
    }
}