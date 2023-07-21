import { connect, NatsConnection, StringCodec, JSONCodec } from "nats.ws";
import { createSignal, onCleanup, onMount, createEffect } from "solid-js";

import "./index.css";
import {
  Session,
  Response,
  RasaDetectedEntity,
  UserTrackerEvent
} from "../common/types";

type NLUResponse = {
  responses: Response[];
  session: Session;
  input_text: string;
  tts: any;
};

export default function Agent() {
  const [nats, setNats] = createSignal<NatsConnection | null>(null);
  const [kvStore, setKvStore] = createSignal<Session[]>([]);
  const sc = StringCodec();
  const jc = JSONCodec();

  onMount(async () => {
    const nc = await connect({
      servers: ["ws://192.168.0.210:8080"],
      user: "agent",
      pass: "password"
    });
    console.log("got agent nc", nc);
    setNats(nc);
    const js = nc.jetstream();
    const kv = await js.views.kv("SessionStore");
    console.log("got kv");
    const watch = await kv.watch();
    const store = kvStore();
    createEffect(() => {
      (async () => {
        for await (const e of watch) {
          if (e.operation == "PUT") {
            const value = jc.decode(e.value) as Session;
            console.log("put vlaue", value);
            setKvStore((prevStore) => [...prevStore, value]);
          } else {
            console.error("uncaught op", e);
            throw new Error("uncaught operation:" + e.operation);
          }
        }

        console.log("all keys done", store);
        setKvStore(store);
        console.log("after setstore", store, kvStore());
      })();
    });
  });

  onCleanup(async () => {
    nats()?.close();
  });

  return (
    <>
      {nats() ? (
        <div class="container">
          <h2>All Sessions</h2>
          <table class="session-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Last Intent</th>
                <th>Logs</th>
              </tr>
            </thead>
            <tbody>
              {kvStore().map((session, index) => (
                <tr>
                  <td>{session._id}</td>
                  <td>{session.lastIntent}</td>
                  <td>
                    <table class="log-table">
                      <thead>
                        <tr>
                          <th>Log</th>
                          <th>Intent</th>
                          <th>Action</th>
                          <th>Date</th>
                          <th>Detected Entities</th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.tracker.map((log, logIndex) => (
                          <tr>
                            <td>{logIndex + 1}</td>
                            <td>{log.intent}</td>
                            <td>{log.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <h1>Connecting to NATS...</h1>
      )}
    </>
  );
}
