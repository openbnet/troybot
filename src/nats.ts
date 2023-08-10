import {
  connect,
  NatsConnection,
  StringCodec,
  AckPolicy,
  DeliverPolicy,
  JSONCodec
} from "nats";
import { Session, UserTrackerEvent } from "../common/types";
import { Customer } from "../client/Customer";
import { getBestTranscript, toLowerCaseObj } from "../common/Utils";
import {
  endUserSession,
  logUserSession,
  processMsg // Add a sessionsSet to store the sessions
} from "../common/MainUtils";


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
async function main() {
  const nc: NatsConnection = await connect({
    servers: "nats_local:4222",
    user: "nlu",
    pass: "password"
  });
  const js = nc.jetstream();
  const kv = await js.views.kv("SessionStore", { history: 1 });
  console.log("connected to nc");
  const sc = StringCodec();
  const jc = JSONCodec();
  const subj = `service.nlu`;
  const sub = await nc.subscribe(subj, { queue: "nlu" });
  (async () => {
    for await (const m of sub) {
      console.log("got m of sub", sub);
      console.log("m reply", m.reply);
      const client_id = m.reply?.split(".")[1];
      if (!client_id) throw Error("no client id");
      // Load the session using the client_id if it exists; otherwise, create a new one.
      let curr_session;
      let stored_kv = await kv.get(client_id);
      if (stored_kv) {
        curr_session = jc.decode(stored_kv.value) as Session;
      } else {
        curr_session = {
          _id: client_id,
          Entities: {},
          lastIntent: "Root",
          affectedContexts: [],
          tracker: []
        } as Session;
      }
      console.log("gona send to stt");
      const sttRes = await nc.request("service.stt", m.data, {
        timeout: 20000
      });
      const payload = sc.decode(sttRes.data);
      const [responses, session, logs] = await processMsg(
        Customer,
        payload,
        curr_session // Pass the session to processMsg
      );
      console.log("processMsg logs", logs);
      console.log("m", m.reply);
      console.log("payload", payload);
      // Store the latest session in the set before returning the response
      kv.put(client_id, jc.encode(session));

      let responseTxt = "";
      for (const res of responses) {
        if (res.text) {
          responseTxt += res.text;
        }
      }

      // get tts
      const response_wav = await getTortiseTTS(responseTxt)
      console.log("gona respond", response_wav);
      await m.respond(
        jc.encode({
          responses,
          session,
          input_text: payload
        })
      );
      console.log("responded");
    }
    console.log("subscription closed");
  })();
}
async function disconnect() {
  const nc: NatsConnection = await connect({
    servers: "nats_local:4222",
    user: "nlu",
    pass: "password"
  });
  console.log("connected to nc");
  const sc = StringCodec();
  const jc = JSONCodec();
  const subj = `service.disconnect`;
  const sub = await nc.subscribe(subj);
  const js = nc.jetstream();
  const kv = await js.views.kv("SessionStore", { history: 1 });
  (async () => {
    for await (const m of sub) {
      console.log("m reply", m.reply);
      const client_id = m.reply?.split(".")[1];
      if (!client_id) throw Error("no client id");
      console.log("client_id", client_id, sc.decode(m.data));
      if (client_id !== sc.decode(m.data)) throw Error("wrong client id");
      await kv.delete(client_id);
      m.respond(sc.encode("200"));
    }
    console.log("subscription closed");
  })();
}

console.log(main());
console.log(disconnect());
