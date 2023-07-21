import { CustomerSettings } from "../common/types";

export const Customer: CustomerSettings = {
    version: "0",
    id: "OpenBNetworks",
    nlu: "rasa",
    defaultResponse: {
        text: "Hi. I'm Troy, a bot for OpenB Networks. We are a software development consultancy that specializes in blockchain and AI solutions. We have tons of experience with enterprise systems."
    },
    orderChannel: {
        name: "telegram",
        chatId: "-992787926",
        token: "245198158:AAH3nfivutWvIYVDcrn5IHc1lQpno512TEU"
    },
    SalesItems: [
        {
            id: "wordpress",
            class: "web",
            sizes: [
                {
                    name: "Basic package",
                    synonyms: ["standard package"],
                    addPrice: 1000
                }
            ],
            display_name: "Wordpress development",
            synonyms: [],
            description: "We only support wpengine hosted sites",
        },
        {
            id: "evm",
            class: "blockchain",
            display_name: "Etherum virtual machine development",
            synonyms: [],
            sizes: [
                {
                    name: "Man day",
                    synonyms: ["Developer day"],
                    addPrice: 1600
                }
            ],
            description: "Custom smart contracts",
        },
        {
            id: "chatbot",
            class: "ai",
            display_name: "Custom chatbots",
            synonyms: [],
            sizes: [
                {
                    name: "Man day",
                    synonyms: ["Developer day"],
                    addPrice: 1600
                }
            ],
            description:
                "We support development of chatbots using this TroyBot framework",

        },
    ],
    Intents: [
        {
            id: "GetSkills",
            utterances: [
                "tell me what you can do",
                "what skills do you have",
                "what features do you have",
                "what can you do for me",
                "how can you help me",
                "what can you do"
            ],
            responses: [
                {
                    text: "Intents[*].id",
                    action: "JmesPathAction",
                    actionResponse: "I have the following skills ${actionOutput}"
                }
            ]
        },
        {
            id: "Affirm", // PrimitiveIntent
            utterances: ["yes", "yes ${Polite}", "yup", "thats right"],
            required_entities: ["requested_slot"],
            noFills: ["Polite@Polite"]
        },
        {
            id: "Deny", // PrimitiveIntent
            utterances: [
                "no",
                "no ${Polite}",
                "thats wrong",
                "you are wrong",
                "incorrect"
            ],
            required_entities: ["requested_slot"],
            noFills: ["Polite@Polite"]
        },
        {
            id: "ResetSession",
            utterances: ["reset session", "forget everything"],
            responses: [
                {
                    text: "Okay I have reset your session",
                    resetContexts: true // false is default
                }
            ]
        },
        {
            id: "UndoLast",
            utterances: ["undo last message", "undo last command", "rewind"],
            responses: [
                {
                    text: "Okay I have undone the last message",
                    resetContexts: "rewind" // false is default
                }
            ]
        },
        {
            id: "hello",
            utterances: ["hi", "hello", "how are you", "whats up"],
            responses: [
                {
                    text: "Hi. I'm Troy, a bot for OpenB Networks. We are a software development consultancy that specializes in blockchain and AI solutions. We have tons of experience with enterprise systems."
                }
            ]
        }
    ],
    EntityFills: [
    ],
    Agent: {
        supportedLanguages: ["en", "en-au"],
        defaultTimezone: "Asia/Singapore",
        stackDriverLogs: false,
        interactionLogs: true,
        mlMinimumConfidence: 0.3,
        fuzzyAutoAcceptConfidence: 0.8,
        rasaOptions: {
            // url: "http://0.0.0.0:5005",
            url: "http://rasa:5005",
            token: "unused"
        },
        actionServer: {
            url: "http://localhost:5055/actionServer",
            token: "unused"
        },
        logMongo: {
            url: "mongodb+srv://localhost:27017/actionServer"
        }
    }
};
