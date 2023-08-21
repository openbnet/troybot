import { CustomerSettings } from "../common/types";

export const Customer: CustomerSettings = {
    version: "0",
    id: "OpenBNetworks",
    nlu: "rasa",
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
        maintainace_fee: 920,
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
                "how many square foot the place?",
                "what is the size of the unit?",
            ],
            responses: [
                {
                    text: "RealEstateItem.size",
                    action: "JmesPathAction",
                    actionResponse: "This unit is ${actionOutput} square feet"
                },
                {
                    text: "NotUsed",
                    action: "JsonLogicAction",
                    actionConfig: {
                        "*": [{ var: "RealEstateItem.size" }, "0.09290304"]
                    },
                    actionResponse: "or ${actionOutput} square meters",
                },
                {
                    text: "with a beautiful unblocked panoramic view of Orchard and Greenery View. Its also a freehold unit with 4 bedrooms and 3 bathrooms. You can access the unit via a Private lift, which opens to a foyer area."
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
        {
            id: "NumberRooms",
            utterances: [
                "How many bedrooms are there in the unit?",
                "How many rooms total?",
            ],
            responses: [
                {
                    text: "RealEstateItem.rooms",
                    action: "JmesPathAction",
                    actionResponse: "There is a total of ${actionOutput} bedrooms",
                },
                {
                    text: "RealEstateItem.bath",
                    action: "JmesPathAction",
                    actionResponse: "and ${actionOutput} bathrooms in the unit.",
                },
                {
                    text: "The master room and junior maste room each has an ensuite toilet, while the jack and jill room has a shared toilet. For the guest there is also a powder room so you maintain the privacy of your family while you entertain your guests. Let me whatsapp you the floor plan so you can visualize the place."
                }
            ]
        },
        {
            id: "MaintainceFee",
            utterances: [
                "What is the maintenance fee?",
                "What is the MCST fee?",
            ],
            responses: [
                {
                    text: "RealEstateItem.maintaince_fee",
                    action: "JmesPathAction",
                    actionResponse: "The monthly maintenance fee is $${actionOutput} per month",
                },
            ]
        },
        {
            id: "UnitDesc",
            utterances: [
                "Tell me more about the ${RealEstateType}",
                "Can you give me a description of the ${RealEstateType}",
                "can you give me an overview of the ${RealEstateType}"
            ],
            entities: ["RealEstateType@RealEstateType"],
            responses: [

                {
                    text: "You can access the unit via the private lift lobby with its own foyer area. The main door faces South West. The dining room can confrotably sit a 10 seater dining roomto your left and the litchen to the right.  The dining room is connected to the living room to it left. A common walkway connects the master room, a jack and jill room and a junior master room. Behind the kitchen is a shared space for a study which can be converted into another bed room, There is also a space for a yard and a bomb shelter. This unit features an all round balconay with 360 panoramic view of orchard and greenview",
                    booleanCondition: {
                        "==": [{ var: "RealEstateType" }, "unit"]
                    }
                },
                {
                    text: "This Freehold project, built by Buildhome Private Limited, T O P in 2011, with a low density of just 53 units.",
                    booleanCondition: {
                        "==": [{ var: "RealEstateType" }, "project"]
                    }
                }

            ]
        },

        {
            id: "ProjectFacilities",
            utterances: [
                "What are the amenities in the condo?",
                "What facilities does the condo have?",
                "Condo facilities?",
                "Condo Amenities?",
                "Have swimming pool?"
            ],
            responses: [
                {
                    text: "It has facilities like Gym room, Swimming pool, children playground, Barbeque pits and a 80 basement carpark lots.",
                },
            ]
        },
        {
            id: "Maidsroom",
            utterances: [
                "Is there a maids room?",
                "is there a room for my helper?",
            ],
            responses: [
                {
                    text: "Yes, you convert the study to a small living quarters",
                },
            ]
        },
        {
            id: "MasterRoomSize",
            utterances: [
                "How big is the master room?",
                "what is the master bedroom size?",
            ],
            responses: [
                {
                    text: "The master room can fit a  king size bed, it has built in dresser, walk in wardrobe and an ensuite toilet. The toilet has an embedded bath tub, stand in shower and a husband wife sink.",
                },
            ]
        },
        {
            id: "PrimarySchools",
            utterances: [
                "Which Primary schools are near by?",
                "What Primary Schools are near?",
                "What are the primary schools around this place?"
            ],
            responses: [
                {
                    text: "RealEstateItem.nearby.schools[?type == 'Primary'].name | []",
                    action: "JmesPathAction",
                    actionResponse: "We have ${actionOutput}"
                },
                {
                    text: "RealEstateItem.nearby.schools[?type == 'Primary'].distance | []",
                    action: "JmesPathAction",
                    actionResponse: "that are ${actionOutput} kilometers away"
                }
            ]
        },
        {
            id: "SecondarySchools",
            utterances: [
                "Which Secondary schools are near by?",
                "What Secondary Schools are near?",
                "What are the Secondary schools around this place?"
            ],
            responses: [
                {
                    text: "RealEstateItem.nearby.schools[?type == 'Secondary'].name | []",
                    action: "JmesPathAction",
                    actionResponse: "We have ${actionOutput}"
                },
                {
                    text: "RealEstateItem.nearby.schools[?type == 'Secondary'].distance | []",
                    action: "JmesPathAction",
                    actionResponse: "that are ${actionOutput} kilometers away"
                }
            ]
        }
    ],
    UnknownIntentFallback: {
        id: "UnknownIntentFallback",
        utterances: [
        ],
        responses: [
            {
                text: "sorry im unable to answer your question ${userText}, once i find the answer i'll get back to you.",
            }
        ]
    },
    EntityFills: [
        {
            name: "RealEstateType",
            mappedTo: "RealEstateType",
            type: "text",
            required: [],
            validation: [
                {
                    jmesPath: "RealEstateType",
                    noSuggestRes:
                        "Sorry I dont understand ${RealEstateType}. Did you want to know about the unit or the project?",
                    suggestRes: "Did you mean ${topSuggest}?" // topSuggest hardcoded into mapping handler
                },
            ],
            responses: [
                {
                    text: "Did you want to know about the unit or project?"
                },
            ] // handles no entity slot in
        },
    ],
    Agent: {
        supportedLanguages: ["en", "en-au"],
        defaultTimezone: "Asia/Singapore",
        stackDriverLogs: false,
        interactionLogs: true,
        mlMinimumConfidence: 0.1,
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
