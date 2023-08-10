import { connect, NatsConnection, StringCodec, JSONCodec } from 'nats';

describe('End-to-End Test', () => {
    let nc: NatsConnection;
    const sc = StringCodec();
    const jc = JSONCodec();

    beforeAll(async () => {
        nc = await connect({
            servers: 'nats://localhost:4222', // Change this to your NATS server URL
            user: 'web',
            pass: 'password',
        });
    });

    afterAll(() => {
        nc.close();
    });

    it('should receive a response when sending "hello"', async () => {
        // Prepare the test data
        const response = await nc.request("service.tortise", sc.encode("Hi. I'm Troy, a bot for OpenB Networks. We are a software development consultancy that specializes in blockchain and AI solutions. We have tons of experience with enterprise systems."), {
            timeout: 10000
        });
        console.log("response", sc.decode(response.data))
    }, 60000);
});
