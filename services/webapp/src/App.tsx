import { connect, NatsConnection, StringCodec, JSONCodec } from "nats.ws";
import { createSignal, onCleanup, onMount, createEffect } from "solid-js";
import { SpeechProbabilities } from "@ricky0123/vad/dist/models";
import "./index.css";
import { Session, Response } from "../common/types";
import { Howl } from "howler";
type NLUResponse = {
  responses: Response[];
  session: Session;
  input_text: string;
  tts: any;
};

export default function App() {
  const [nats, setNats] = createSignal<NatsConnection | null>(null);
  const [session, setSession] = createSignal<Session | null>(null);
  const sc = StringCodec();
  const jc = JSONCodec();
  const [vad, setVad] = createSignal(null);
  const [transcriptionHistory, setTranscriptionHistory] = createSignal<
    string[]
  >([]);

  onMount(async () => {
    const nc = await connect({
      servers: ["ws://127.0.0.1:8088"],
      user: "web",
      pass: "password"
    });
    console.log("got nc", nc);
    setNats(nc);
    if (typeof window.vadit === "function") {
      console.log("got window function");
      window.vadit(onSpeechEndCB).then((vad) => {
        console.log("gona set vad");
        vad.start();
        setVad(vad);
      });
    } else {
      console.log("cant find vait");
    }
  });

  onCleanup(async () => {
    console.log("oncleanup");
    let sess = session();
    if (sess) {
      await nats()?.request("service.disconnect", sc.encode(sess._id), {
        timeout: 200
      });
    }
    nats()?.close();
  });

  const natsRequestNLU = async (
    subj: string,
    msg: Float32Array
  ): Promise<NLUResponse> => {
    const nc = nats();
    if (!nc) throw Error("no nc");
    try {
      const response = await nc.request(subj, jc.encode(msg), {
        timeout: 20000
      });
      // Convert the received Uint8Array response to string (assuming it's a string)
      return jc.decode(response.data) as NLUResponse;
    } catch (error) {
      console.error("nc error", error);
      throw Error("cant req");
    }
  };
  const natsRequestTTS = async (subj: string, msg: string) => {
    const nc = nats();
    if (!nc) throw Error("no nc");
    try {
      console.log("gota request tts", subj, msg);
      const response = await nc.request(subj, sc.encode(msg), {
        timeout: 20000
      });
      console.log("got res");
      // Convert the received Uint8Array response to string (assuming it's a string)
      return sc.decode(response.data);
    } catch (error) {
      console.error("nc error", error);
      throw Error("cant req");
    }
  };

  const natsRequestTTSClone = async (subj: string, msg: string) => {
    const url = "https://7882c4bd6e5cf4f0e9.gradio.live";
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
  };
  const generateUniqueId = () => {
    return Math.random().toString(36).substr(2, 9);
  };

  // recording stuff
  async function onSpeechEndCB(audio) {
    console.log("onSpeechEndCB", audio);
    const startTime = Date.now();
    const nluRes = await natsRequestNLU("service.nlu", audio);

    const responseTime = (Date.now() - startTime) / 1000;
    console.log("nluRes", nluRes);
    const num_s = audio.length / 16000;
    let responseTxt = "";
    for (const res of nluRes.responses) {
      if (res.text) {
        responseTxt += res.text;
      }
    }
    setSession(nluRes.session);
    setTranscriptionHistory((prevHistory) => [
      ...prevHistory,
      `User: ${nluRes.input_text}`
    ]);
    setTranscriptionHistory((prevHistory) => [
      ...prevHistory,
      `Bot: ${responseTxt}  (Response: ${responseTime}, Ratio: ${responseTime / num_s
      })`
    ]);

    // get audio data
    const ttsRes = await natsRequestTTS("service.tts", responseTxt);

    // Create a Howl instance
    const howl = new Howl({
      // src: ["data:audio/wav;base64," + ttsRes],
      src: [ttsRes],
      format: "wav",
      onend: () => {
        console.log("Sound has finished playing");
      }
    });

    console.log("howl", howl);
    // Play the audio
    howl.play();
  }

  return (
    <>
      {nats() ? (
        <div class="container">
          <div class="chat-container">
            <h2>Transcription History:</h2>
            <ul class="chat-history">
              {transcriptionHistory().map((transcription, index) => {
                const isBotResponse = transcription.startsWith("Bot: ");
                if (isBotResponse) {
                  // Extract response and ratio from the response message
                  const responseMsg = transcription.replace("Bot: ", "");
                  const [responseText, responseInfo] =
                    responseMsg.split(" (Response: ");
                  const responseTime = parseFloat(responseInfo.split(",")[0]);
                  const ratio = parseFloat(
                    responseInfo.split(", Ratio: ")[1].replace(")", "")
                  );

                  return (
                    <li class="chat-message">
                      {transcription}
                      <div class="response-info">
                        Response: {responseTime}s, Ratio: {ratio}
                      </div>
                    </li>
                  );
                } else {
                  return <li class="chat-message">{transcription}</li>;
                }
              })}
            </ul>
          </div>
        </div>
      ) : (
        <h1>Connecting to NATS...</h1>
      )}
    </>
  );
}
