import { transformEmailsToCountry } from "../common/Email";
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


    it.only("should transform emails in text to country based", async () => {
        const txt = "got your email hansel@openb.net"
        const res = transformEmailsToCountry(txt)
        expect(res).toBe("got your email Hong Kong\n America\n Norway\n Singapore\n England\n London\n at Osaka\n Paris\n England\n Norway\n Britain\n dot net")
    })
    it.only("transform should work with dashes and 2 tier tlds", async () => {
        const txt = "got your email i-am-stupid@blah.co.uk"
        const res = transformEmailsToCountry(txt)
        expect(res).toBe("got your email India\n dash America\n Malaysia\n dash Singapore\n Thailand\n Uganda\n Paris\n India\n Denmark\n at Britain\n London\n America\n Hong Kong\n dot China\n Osaka\n dot uk")
    })
    it.only("should not transform non emails", async () => {
        const txt = "got your email"
        const res = transformEmailsToCountry(txt)
        expect(res).toBe("got your email")
    })
})