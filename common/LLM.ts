import {
    connect,
    NatsConnection,
    StringCodec,
    AckPolicy,
    DeliverPolicy,
    JSONCodec
} from "nats";

export async function getLLM(nc: NatsConnection, llm: string, msg: string) {
    const sc = StringCodec();
    const res = await nc.request("service." + llm, sc.encode(msg), {
        timeout: 60000
    })
    return sc.decode(res.data)
}

export async function getEmailLLM(nc: NatsConnection, llm: string, msg: string) {
    const prompt = `Extract an email address from the given text. The email address should be in the format of "local-part@domain.tld". Respond with only one email address in proper email format from the text. Respond with null if no email address exists. text: `

    const res = (await getLLM(nc, llm, prompt + msg)).replace(/\n/g, "")
    if (res == "local-part@domain.tld") {
        // ugly hack, need a better llm
        return null
    }
    return res

}