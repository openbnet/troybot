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
    ],
    RealEstateItem: {
        // https://www.propertyguru.com.sg/listing/for-sale-the-lumos-24480308
        id: "TheLumos_16-01",
        class: "condo",
        main_address: "9 Leonie Hill",
        unit_address: "16-01",
        rooms: 4,
        bath: 3,
        size: 2432, //sq ft
        asking_psf_price: 2524,
        display_name: "The Lumos",
        synonyms: [],
        description: "4 Bedder Unit With Private Lift & Unblocked Views",
        nearby: {
            transport: [
                {
                    type: "MRT",
                    name: "Great World (TE15)",
                    distance: "0.6" // km
                },
                {
                    type: "MRT",
                    name: "Somerset MRT (NS23)",
                    distance: "0.79" // km
                }
            ],
            malls: [
                {
                    type: "ShoppingCenter",
                    name: "Scape",
                    distance: "0.46"
                },
                {
                    type: "ShoppingCenter",
                    name: "Takashimaya Shopping Centre",
                    distance: "0.47"
                },
                {
                    type: "ShoppingCenter",
                    name: "ION Orchard",
                    distance: "0.55"

                }
            ],
            groceries: [
                {
                    type: "SuperMarket",
                    name: "Cold Storage @ Takashimaya",
                    distance: "0.47"
                },
                {
                    type: "SuperMarket",
                    name: "CS Fresh @ Great World",
                    distance: "0.63"
                },
                {
                    type: "SuperMarket",
                    name: "CS Fresh @ Paragon",
                    distance: "0.63"
                },
                {
                    type: "SuperMarket",
                    name: "Fairprice @ Orchard Grand Court",
                    distance: "0.75"
                }
            ],
            eateries: [
                {
                    type: "FoodCourt",
                    name: "Zion Riverside Food Centre",
                    distance: "0.75"
                },
                {
                    type: "Market",
                    name: "Beo Crescent Market",
                    distance: "1.25"
                },
                {
                    type: "Market",
                    name: "Havelock Road Cooked Food Centre ",
                    distance: "1.26"
                }
            ],
            schools: [
                {
                    type: "Primary",
                    name: "River Valley Primary School",
                    distance: "0.68",
                },
                {
                    type: "Primary",
                    name: "River Valley Primary School",
                    distance: "0.68"
                },
                {
                    type: "Primary",
                    name: "Alexandra Primary School",
                    distance: "1.21"
                },
                {
                    type: "Primary",
                    name: "Anglo-Chinese School (Junior)",
                    distance: "1.55"
                },
                {
                    type: "Primary",
                    name: "Zhangde Primary School",
                    distance: "1.79"
                },
                {
                    type: "Secondary",
                    name: "Gan Eng Seng School",
                    distance: "1.45"
                },
                {
                    type: "Secondary",
                    name: "Outram Secondary School",
                    distance: "1.5"
                }, {
                    type: "Secondary",
                    name: "Crescent Girls' School",
                    distance: "1.74"
                }
            ],
            recreation: [
                {
                    type: "Park",
                    name: "Ganges Avenue Open Space",
                    distance: "0.92"
                },
                {
                    type: "CommunityCenter",
                    name: "Kim Seng Community Club",
                    distance: "1.05"
                },
                {
                    type: "Park",
                    name: "Singapore Botanic Gardens",
                    distance: "2.64"
                }
            ]
        }
    },
    Intents: [
        {
            id: "UnitSize",
            utterances: [
                "how big is this place",
                "how many square foot is this?",
                "what is the size ah?",
            ],
            responses: [
                {
                    text: "RealEstateItem.size",
                    action: "JmesPathAction",
                    actionResponse: "This unit is ${actionOutput} square feet"
                }
            ]
        },
        {
            id: "UnitPricePSF",
            utterances: [
                "what is the PSF?",
                "how much per square foot?",
                "how much per square feet?",
                "what is the square foot price?",
            ],
            responses: [
                {
                    text: "RealEstateItem.asking_psf_price",
                    action: "JmesPathAction",
                    actionResponse: "This unit is $${actionOutput} per square foot"
                }
            ]
        },
        {
            id: "UnitPriceTotal",
            utterances: [
                "what is owner asking for?",
                "what is the price",
                "how much am i expecting to pay?"
            ],
            responses: [
                {
                    text: "UNUSED",
                    action: "JsonLogicAction",
                    actionConfig: {
                        "*": [{ var: "RealEstateItem.size" }, { var: "RealEstateItem.asking_psf_price" }]
                    },
                    actionResponse: "The owner is asking for $${actionOutput}",
                }
            ]
        },
        {
            id: "ToiletBowlBrand",
            utterances: [
                "What brand is the toilet bowl?",
                "what toilet bowl is installed?",
            ],
            responses: [
                {
                    text: "Sorry I am not sure what toilet bowl is used, let me check with the owner and get back to you.",
                }
            ]
        },
    ],
    UnknownIntentFallback: {
        id: "UnknownIntentFallback",
        utterances: [
        ],
        responses: [
            {
                text: "Sorry I am not able to answer your question, is it related to this property?",
            }
        ]
    },
    EntityFills: [
    ],
    Agent: {
        supportedLanguages: ["en", "en-au"],
        defaultTimezone: "Asia/Singapore",
        stackDriverLogs: false,
        interactionLogs: true,
        mlMinimumConfidence: 0.6,
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
