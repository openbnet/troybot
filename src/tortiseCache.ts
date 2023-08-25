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
                        // const rvcRes = getRVC(cachedFilePath, fs.readFileSync(cachedFilePath).toString("base64"))
                        // console.log("rvcRes", rvcRes)
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
                    "rachel", // Voice
                    null, // Microphone source (not used)
                    0, // Voice chunks
                    1, // Candidates
                    0, // Seed
                    16, // Samples
                    100, // Iterations
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


async function getRVC(filename: string, wavbase64: string) {
    const url = "http://rvc:7865";
    try {
        const response = await fetch(url + "/run/infer_convert ", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                "data": [

                    0, // represents selected value of 'Select Speaker/Singer ID:' Slider component

                    "", // represents text string of 'Enter the path of the audio file to be processed (default is the correct format example):' Textbox component

                    0, // represents numeric value of 'Transpose (integer, number of semitones, raise by an octave: 12, lower by an octave: -12):' Number component

                    { "name": filename, "data": "data:audio/wav;base64," + wavbase64 }, // represents file name and base64 data as an object of 'F0 curve file (optional). One pitch per line. Replaces the default F0 and pitch modulation:' File component

                    "rmvpe", // represents selected choice of 'Select the pitch extraction algorithm ('pm': faster extraction but lower-quality speech; 'harvest': better bass but extremely slow; 'crepe': better quality but GPU intensive), 'rmvpe': best quality, and little GPU requirement' Radio component

                    "", // represents text string of 'Path to the feature index file. Leave blank to use the selected result from the dropdown:' Textbox component

                    "logs/ruru/added_IVF689_Flat_nprobe_1_ruru_v1.index", // represents selected choice of 'Auto-detect index path and select from the dropdown:' Dropdown component

                    0.75, // represents selected value of 'Search feature ratio (controls accent strength, too high has artifacting):' Slider component

                    3, // represents selected value of 'If >=3: apply median filtering to the harvested pitch results. The value represents the filter radius and can reduce breathiness.' Slider component

                    0, // represents selected value of 'Resample the output audio in post-processing to the final sample rate. Set to 0 for no resampling:' Slider component

                    0.5, // represents selected value of 'Adjust the volume envelope scaling. Closer to 0, the more it mimicks the volume of the original vocals. Can help mask noise and make volume sound more natural when set relatively low. Closer to 1 will be more of a consistently loud volume:' Slider component

                    0.33, // represents selected value of 'Protect voiceless consonants and breath sounds to prevent artifacts such as tearing in electronic music. Set to 0.5 to disable. Decrease the value to increase protection, but it may reduce indexing accuracy:' Slider component
                ]
            })
        })
            .then((res) => res.json())
            .catch((err) => {
                console.error("getRVC", err);
                throw new Error("getRVC error");
            });
        console.log("getRVC res", response);
        // Get the audio file from the response
        return response
    } catch (error) {
        console.error("TTS error", error);
        throw new Error("Failed to request TTS");
    }
}
async function getRVCBatch(filename: string, wavbase64: string) {
    const url = "http://rvc:7865";
    try {
        const response = await fetch(url + "/run/infer_convert_batch ", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                "data": [

                    0, // represents selected value of 'Select Speaker/Singer ID:' Slider component

                    "", // represents text string of 'Enter the path of the audio folder to be processed (copy it from the address bar of the file manager):' Textbox component

                    "TEMP", // represents text string of 'Specify output folder:' Textbox component

                    { "name": filename, "data": "data:audio/wav;base64," + wavbase64 }, // represents file name and base64 data as an object of 'You can also input audio files in batches. Choose one of the two options. Priority is given to reading from the folder.' File component

                    0, // represents numeric value of 'Transpose (integer, number of semitones, raise by an octave: 12, lower by an octave: -12):' Number component

                    "rmvpe", // represents selected choice of 'Select the pitch extraction algorithm ('pm': faster extraction but lower-quality speech; 'harvest': better bass but extremely slow; 'crepe': better quality but GPU intensive), 'rmvpe': best quality, and little GPU requirement' Radio component

                    "", // represents text string of 'Path to the feature index file. Leave blank to use the selected result from the dropdown:' Textbox component

                    "logs/mi-test/added_IVF740_Flat_nprobe_1_mi-test_v1.index", // represents selected choice of 'Auto-detect index path and select from the dropdown:' Dropdown component

                    1, // represents selected value of 'Search feature ratio (controls accent strength, too high has artifacting):' Slider component

                    3, // represents selected value of 'If >=3: apply median filtering to the harvested pitch results. The value represents the filter radius and can reduce breathiness.' Slider component

                    0, // represents selected value of 'Resample the output audio in post-processing to the final sample rate. Set to 0 for no resampling:' Slider component

                    1, // represents selected value of 'Adjust the volume envelope scaling. Closer to 0, the more it mimicks the volume of the original vocals. Can help mask noise and make volume sound more natural when set relatively low. Closer to 1 will be more of a consistently loud volume:' Slider component

                    0.33, // represents selected value of 'Protect voiceless consonants and breath sounds to prevent artifacts such as tearing in electronic music. Set to 0.5 to disable. Decrease the value to increase protection, but it may reduce indexing accuracy:' Slider component

                    "wav", // represents selected choice of 'Export file format' Radio component
                ]
            })
        })
            .then((res) => res.json())
            .catch((err) => {
                console.error("getRVC", err);
                throw new Error("getRVC error");
            });
        console.log("getRVC res", response);
        // Get the audio file from the response
        return response
    } catch (error) {
        console.error("TTS error", error);
        throw new Error("Failed to request TTS");
    }
}