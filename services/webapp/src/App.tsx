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
  const [phoneNumber, setPhoneNumber] = createSignal<string | null>(
    localStorage.getItem("phoneNumber") || null
  );
  const [name, setName] = createSignal<string | null>(
    localStorage.getItem("name") || null
  );




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

    // Check if session data exists in localStorage
    let storedPhoneNumber = localStorage.getItem("phoneNumber");
    let storedName = localStorage.getItem("name");

    if (!storedPhoneNumber || !storedName) {
      // Prompt the user for phone number and name
      const newPhoneNumber = prompt("Please enter your phone number:");
      const newName = prompt("Please enter your name:");
      if (newPhoneNumber && newName) {
        localStorage.setItem("phoneNumber", newPhoneNumber);
        localStorage.setItem("name", newName);
        setPhoneNumber(newPhoneNumber);
        setName(newName);
        storedName = newName
        storedPhoneNumber = newPhoneNumber
      } else {
        alert("Phone number and name are required.");
      }
    }
    // say hello
    const ttsRes = await natsRequestTTS("service.tortise", `hello ${storedName}, I'm troy your agent. How can I help you?`);
    console.log("ttsRes", ttsRes)
    // Create a Howl instance
    const howl = new Howl({
      src: ["data:audio/wav;base64," + ttsRes],
      // src: [ttsRes],
      format: "wav",
      onend: () => {
        console.log("Sound has finished playing");
      }
    });
    howl.play();
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
    msg: {
      voice?: Float32Array,
      text?: string
    }
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

      const startTime = performance.now(); // Record the start time

      const response = await nc.request(subj, sc.encode(msg), {
        timeout: 90000,
      });

      const endTime = performance.now(); // Record the end time

      const timeTaken = endTime - startTime; // Calculate the time taken in milliseconds// Store the time in the state
      setTranscriptionHistory((prevHistory) => [
        ...prevHistory,
        `TTS Time: ${timeTaken / 1000}`
      ]);
      console.log("got res");
      return sc.decode(response.data);
    } catch (error) {
      console.error("nc error", error);
      throw Error("cant req");
    }
  };



  // recording stuff
  let howlInstance;
  async function onSpeechEndCB(audio) {
    if (howlInstance) {
      howlInstance.stop()
    }
    console.log("onSpeechEndCB", audio);
    const startTime = Date.now();
    const nluRes = await natsRequestNLU("service.nlu", { voice: audio });

    const responseTime = (Date.now() - startTime) / 1000;
    console.log("nluRes", nluRes);
    const num_s = audio.length / 16000;
    let responseTxt = "";
    for (const res of nluRes.responses) {
      if (res.text) {
        responseTxt += " " + res.text;
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
    const ttsRes = await natsRequestTTS("service.tortise", responseTxt);
    console.log("ttsRes", ttsRes)
    // Create a Howl instance
    howlInstance = new Howl({
      src: ["data:audio/wav;base64," + ttsRes],
      // src: [ttsRes],
      format: "wav",
      onend: () => {
        console.log("Sound has finished playing");
      }
    });
    // Play the audio
    howlInstance.play();
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
