import { getEmailLLM } from "../common/LLM"
import {
    connect,
    NatsConnection,
    StringCodec,
    AckPolicy,
    DeliverPolicy,
    JSONCodec
} from "nats";
describe("text to email", () => {
    const llm = "falcon7b"
    it("should handle 1 tier", async () => {

        const nc: NatsConnection = await connect({
            servers: "localhost:4222",
            user: "web",
            pass: "password"
        });
        const res = await getEmailLLM(nc, llm, "my email is john69 at gmail dot com")
        console.log("res", res)
        expect(res).toBe("john69@gmail.com")
    }, 30000)
    it("should handle 2 tier", async () => {

        const nc: NatsConnection = await connect({
            servers: "localhost:4222",
            user: "web",
            pass: "password"
        });
        const res = await getEmailLLM(nc, llm, "my email is jonny one at berserk dot com dot sg")
        console.log("res", res)
        expect(res).toBe("jonnyone@berserk.com.sg")
    }, 30000)
    it("should handle complex emails", async () => {

        const nc: NatsConnection = await connect({
            servers: "localhost:4222",
            user: "web",
            pass: "password"
        });
        const res = await getEmailLLM(nc, llm, "my email is jonny one rules at berserk dot com dot sg")
        console.log("res", res)
        expect(res).toBe("jonnyonerules@berserk.com.sg")
    }, 30000)


    it("should handle complex emails", async () => {

        const nc: NatsConnection = await connect({
            servers: "localhost:4222",
            user: "web",
            pass: "password"
        });
        const res = await getEmailLLM(nc, llm, "my email is the best wordsmith 2020 at touch grass dot io")
        console.log("res", res)
        expect(res).toBe("thebestwordsmith2020@touchgrass.io")
    }, 30000)

    it("should handle no email", async () => {

        const nc: NatsConnection = await connect({
            servers: "localhost:4222",
            user: "web",
            pass: "password"
        });
        const res = await getEmailLLM(nc, llm, "can you send me an email")
        console.log("res", res)
        expect(res).toBe(null)
    }, 30000)
})