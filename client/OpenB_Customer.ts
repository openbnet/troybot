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
        },
        {
            id: "makeOrder",
            utterances: [
                "i want to order",
                "i would like to make an order",
                "I want to order ${Quantity} ${OrderItem} in ${Size}",
                "i would like to order ${OrderItem}",
                "i would like to order ${Quantity} ${OrderItem}",
                "i would like to order ${Size} ${OrderItem}",
                "i would like to order ${OrderItem} ${Size}",
                "i would like to order ${OrderItem} ${Polite}",
                "Can I order ${Quantity} ${Size} ${OrderItem}?",
                "Can you add ${Quantity} ${Size} ${OrderItem} to my order?",
                "can you add this item to my order?",
                "give me ${OrderItem}",
                "${Polite} give me ${OrderItem}",
                "give me ${OrderItem} ${Polite}",
                "give me ${Size} ${OrderItem}",
                "give me ${Quantity} ${OrderItem}",
                "give me ${Size} ${OrderItem} ${Polite}",
                "${Polite} give me ${Size} ${OrderItem}",
                "give me ${Size} ${OrderItem} ${Quantity}",
                "${Polite} give me ${Size} ${OrderItem} ${Quantity}",
                "give me ${Size} ${OrderItem} ${Quantity} ${Polite}"
            ],
            entities: [
                "OrderItem@SalesItems",
                "Size@SalesItemSizes",
                "Quantity@SysNumber"
            ],
            noFills: ["Polite@Polite"],
            responses: [
                {
                    text: "Okay, I've added ${Quantity} ${Size} ${OrderItem} to your order. What else would you like to order?",
                    affectedContexts: [
                        {
                            name: "hasOrder",
                            lifespanCount: 99 // max of 99 conversation turns
                        }
                    ],
                    resetContexts: "mine", // false is default
                    mapParamToObject: {
                        LastOrderItem: {
                            OrderItem: "makeOrder_OrderItem",
                            Size: "makeOrder_Size",
                            Quantity: "makeOrder_Quantity"
                        }
                    },
                    storeObjectInArray: {
                        OrderItems: "LastOrderItem"
                    }
                }
            ]
        },
    ],
    EntityFills: [
        {
            name: "OrderItem",
            mappedTo: "SalesItems",
            type: "text",
            required: [],
            overwriteSlot: {
                type: "ask",
                response: {
                    text: "detectedEnt.value", // special value detectedEnt fit into only overwriteSlot actions
                    action: "JmesPathAction",
                    actionResponse:
                        "Did you want to change your Order Item from ${OrderItem} to ${actionOutput}?"
                }
            },
            validation: [
                {
                    onlyForIntents: ["makeOrder"],
                    jmesPath: "SalesItems",
                    noSuggestRes:
                        "We do not sell ${OrderItem}. What item would you like to order?",
                    suggestRes: "Did you want to order ${topSuggest}?" // topSuggest hardcoded into mapping handler
                },
            ],
            responses: [
                {
                    onlyForIntents: ["makeOrder"],
                    text: "What item would you like to order?"
                },
            ] // handles no entity slot in
        },
        {
            name: "Size",
            mappedTo: "SalesItemSizes",
            type: "text",
            required: ["OrderItem"],
            overwriteSlot: {
                type: "ask",
                response: {
                    text: "detectedEnt.value", // special value detectedEnt fit into only overwriteSlot actions
                    action: "JmesPathAction",
                    actionResponse:
                        "Did you want to change from ${Size} ${OrderItem} to ${actionOutput}?"
                }
            },
            validation: [
                {
                    jmesPath:
                        "SalesItems[?display_name=='${OrderItem}'].sizes[*].{value: name, synonyms: synonyms} | [0]",
                    noSuggestRes:
                        "it is not available in ${Size}. ${OrderItem} is available in ${actionOutput}, what would you like?",
                    suggestRes: "Did you mean ${topSuggest}"
                }
            ],
            responses: [
                {
                    text: "SalesItems[?display_name=='${OrderItem}'].sizes[].name | []",
                    action: "JmesPathAction",
                    actionResponse:
                        "${OrderItem} is available in ${actionOutput}, what would you like?",
                    affectedContexts: [
                        {
                            name: "makeorder_dialog_context",
                            lifespanCount: 99 // max of 99 conversation turns
                        }
                    ]
                }
            ]
        },
        {
            name: "Quantity",
            mappedTo: "SysNumber",
            type: "float",
            required: ["OrderItem", "Size"],
            overwriteSlot: {
                type: "ask",
                response: {
                    text: "detectedEnt.value", // special value detectedEnt fit into only overwriteSlot actions
                    action: "JmesPathAction",
                    actionResponse:
                        "Did you want to change from ${Quantity} ${OrderItem} to ${actionOutput}?"
                }
            },
            validation: [
                {
                    jmesPath: "SysNumber",
                    noSuggestRes: "Sorry I did not get it, how many did you want?",
                    suggestRes: "Did you mean ${topSuggest}"
                }
            ],
            responses: [
                {
                    text: "SalesItems[?display_name=='${OrderItem}'] | [0].sizes[?name=='${Size}'] | [0].addPrice",
                    action: "JmesPathAction",
                    actionResponse:
                        "${Size} ${OrderItem} costs $${actionOutput}, how many would you like to order?",
                    affectedContexts: [
                        {
                            name: "makeorder_dialog_context",
                            lifespanCount: 99 // max of 99 conversation turns
                        }
                    ]
                }
            ]
        }
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
