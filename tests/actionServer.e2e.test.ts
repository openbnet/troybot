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
        const response = await nc.request("service.nlu", jc.encode({ data: "hello" }), {
            timeout: 20000
        });
        console.log("response", response)
    });
});
