import { CustomerSettings } from "../common/types";

export const Customer: CustomerSettings = {
  version: "0",
  id: "DonsChickenPies",
  nlu: "rasa",
  orderChannel: {
    name: "telegram",
    chatId: "-992787926",
    token: "245198158:AAH3nfivutWvIYVDcrn5IHc1lQpno512TEU"
  },
  aboutUs: {
    featuredPeople: [
      {
        image:
          "https://chickenpie.sg/wp-content/uploads/2022/01/splash-chef-don-kitchen.webp",
        text: "Chef Don Lim's original recipe. 38 years in the making."
      }
    ],
    text: `Personally helmed by Chef Don Lim: Every dish prepared freshly, and every single pastry baked in-house in our restaurant.

        They say that a recipe truly withstands the test of time, if it keeps up with the tastes of the time.
        
        It has been quite a bit of an adventure for Chef Don Lim and his kitchen team. From his previous shop at Far East Square (China Street) and China Square in the early 2000s, to a coffeeshop at 206 Toa Payoh North from 2014, to a (very, very painful) partnership at an industrial canteen in 1008A Toa Payoh North in 2019... and finally here we are, only exclusively at 39 Tyrwhitt Road, Singapore 207538.`
  },
  hello: {
    text: "Welcome to Don's chicken pies. How can I help you today?"
  },
  Store: {
    Alchohol: {
      hasLicense: true,
      Corkage: {
        price: 20
      }
    },

    disclaimers: ["No outside food and drinks"]
  },
  Tables: [
    {
      id: 1,
      seating: 5,
      petsAllowed: true
    },
    {
      id: 2,
      seating: 5,
      petsAllowed: false
    }
  ],
  Menu: [
    {
      id: "ChickenPie",
      class: "pie",
      display_name: "Chicken Pie",
      synonyms: [],
      description: "Chef Don Lim’s original chicken pie recipe since 1983",
      sizes: [
        {
          name: "Personal",
          synonyms: ["personnel"],
          addPrice: 6.3
        },
        {
          name: "Whole",
          synonyms: ["hole"],
          addPrice: 28.8
        }
      ],
      options: [[], []],
      ingredients: ["peas", "chicken", "potato", "eggs"],
      disclaimers: ["must be consumed within 2hrs"],
      min_order_amount: 0,
      preparation_minutes: 0
    },
    {
      id: "BlackPepperChickenPie",
      class: "pie",
      display_name: "Black Pepper Chicken Pie",
      synonyms: [],
      description: "If you like extra peppery flavour with that extra “kick”",
      sizes: [
        {
          name: "Personal",
          synonyms: ["personnel"],
          addPrice: 6.3
        },
        {
          name: "Whole",
          synonyms: ["hole"],
          addPrice: 28.8
        }
      ],
      options: [[], []],
      ingredients: ["peas", "chicken", "potato", "eggs", "black_pepper"],
      disclaimers: ["must be consumed within 2hrs"],
      min_order_amount: 0,
      preparation_minutes: 0
    },
    {
      id: "PrawnScallopLaksaBeeHoon",
      display_name: "Prawn & Scallop Laksa Bee Hoon",
      tts_name: "Prawn and scallop larksar bee hoon",
      synonyms: [],
      description:
        "Juicy scallops and prawns on top of thick bee hoon in Chef Don Lim's unique laksa gravy. Topped with freshly dried laksa leaves.",
      class: "prawn",
      sizes: [
        {
          name: "Small",
          synonyms: [],
          addPrice: 4
        },
        {
          name: "Large",
          synonyms: [],
          addPrice: 15
        },
        {
          name: "Extra Large",
          synonyms: [],
          addPrice: 21
        }
      ],
      options: [[], [], []],
      ingredients: ["prawn", "scallop", "bee_hoon", "chilli", "eggs"],
      disclaimers: ["must be consumed within 2hrs"],
      min_order_amount: 0,
      preparation_minutes: 0
    },
    {
      id: "ChickenPieCustom",
      display_name: "Custom Chicken Pie",
      synonyms: [],
      description: "customize your pie",
      class: "pie",
      sizes: [
        {
          name: "Whole",
          synonyms: ["hole"],
          addPrice: 30
        }
      ],
      options: [
        [
          {
            option_type: "peas",
            allowAdd: true,
            addPrice: 2,
            allowSub: true,
            subPrice: 0,
            disclaimers: [],
            preparation_minutes: 0
          },
          {
            option_type: "chicken",
            allowAdd: false,
            addPrice: 0,
            allowSub: true,
            subPrice: -1,
            disclaimers: ["its not purely vegetarian as there is chicken oil"],
            preparation_minutes: 0
          }
        ],
        [
          {
            option_type: "peas",
            allowAdd: true,
            addPrice: 2,
            allowSub: true,
            subPrice: 0,
            disclaimers: [],
            preparation_minutes: 0
          },
          {
            option_type: "chicken",
            allowAdd: false,
            addPrice: 0,
            allowSub: true,
            subPrice: -1,
            disclaimers: ["its not purely vegetarian as there is chicken oil"],
            preparation_minutes: 0
          },
          {
            option_type: "abalone",
            allowAdd: true,
            addPrice: 50,
            allowSub: false,
            subPrice: 0,
            disclaimers: ["will replace chicken with fresh abalone"],
            preparation_minutes: 60
          }
        ]
      ],
      ingredients: ["peas", "chicken", "potato", "eggs"],
      disclaimers: [],
      min_order_amount: 60,
      preparation_minutes: 300
    }
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
          text: "Welcome to Don's chicken pies. How can I help you today?"
        }
      ]
    },
    {
      id: "getCorkage",
      utterances: [
        "can i bring my own ${Alchohol}",
        "do you charge corkage",
        "can i bring my own ${Alchohol}",
        "can bring ${Alchohol}",
        "how much is your corkage charge",
        "do you allow ${Alchohol}",
        "can i bring ${Alchohol}",
        "want to bring own ${Alchohol}"
      ],
      noFills: ["Alchohol@AlchoholTypes"],
      if: {
        booleanCondition: {
          condition: {
            "==": [{ var: "Store.Alchohol.hasLicense" }, true]
          },
          true: {
            id: "getCorkage.true",
            responses: [
              {
                text: "We charge $${Store.Alchohol.Corkage.price} per bottle of corkage fee. Is there anything else I can help you with?"
              }
            ]
          },
          false: {
            id: "getCorkage.false",
            responses: [
              {
                text: "We do not allow alchohol on our premises. Is there anything I can help you with?"
              }
            ]
          }
        }
      }
    },
    {
      id: "getMenu",
      utterances: ["what do you have", "what do you sell", "whats on the menu"],
      if: {
        booleanCondition: {
          condition: {
            ">": [{ var: "Menu.length" }, 10]
          },
          true: {
            id: "getMenu.true",
            responses: [
              {
                text: "We have ${Menu.length} items, would you like to search by ingredients or price instead?"
              }
            ],
            childIntents: [
              {
                id: "getMenu.No",
                utterances: [
                  "no",
                  "na",
                  "nope",
                  "i want the full menu",
                  "just tell me the full menu"
                ],
                responses: [
                  {
                    text: "We have ${Store.Menu}"
                  }
                ]
              },
              {
                id: "getMenu.Yes",
                utterances: ["yes", "yea", "good idea"],
                responses: [
                  {
                    text: "You can search by ingredients or price, ask me about which items have chicken"
                  }
                ]
              },
              {
                id: "getMenu.fallback",
                responses: [
                  {
                    text: "#{RootContext}"
                  }
                ]
              }
            ]
          },
          false: {
            id: "getMenu.false",
            responses: [
              {
                text: "Menu[].display_name",
                action: "JmesPathAction",
                affectedContexts: [
                  {
                    name: "getMenu",
                    lifespanCount: 3 // max of 99 conversation turns
                  }
                ],
                actionResponse: "We have ${actionOutput}."
              }
            ]
          }
        }
      }
    },
    {
      id: "getMenuItemDetails",
      utterances: [
        "tell me more about your menu item",
        "tell me more about your ${OrderItem}",
        "describe ${OrderItem}"
      ],
      entities: ["OrderItem@MenuItems"],
      responses: [
        {
          text: "Menu[?display_name=='${OrderItem}'].description",
          action: "JmesPathAction",
          affectedContexts: [
            {
              name: "getMenuItemDetails",
              lifespanCount: 3 // max of 99 conversation turns
            }
          ], // rasa technically doesnt use this, just enforce it?
          actionResponse: "${actionOutput}"
        },
        {
          text: "Menu[?display_name=='${OrderItem}'] | [0].sizes[*].name",
          action: "JmesPathAction",
          affectedContexts: [
            {
              name: "getMenuItemDetails",
              lifespanCount: 3 // max of 99 conversation turns
            }
          ],
          actionResponse: "We have it in ${actionOutput}"
        },
        {
          text: "Menu[?display_name=='${OrderItem}'] | [0].sizes[*].addPrice",
          action: "JmesPathAction",
          prefixActionOutputArray: "$",
          resetContexts: "mine",
          affectedContexts: [
            {
              name: "getMenuItemDetails",
              lifespanCount: 3 // max of 99 conversation turns
            }
          ],
          actionResponse: "which cost ${actionOutput}"
        }
      ]
    },
    // {
    //     id: "askPrice",
    //     utterances: [
    //         "how much is ${OrderItem}?",
    //         "what is the price of ${OrderItem}"
    //     ],
    //     entities: [
    //         "OrderItem@MenuItems",
    //     ],
    //     responses: [
    //         {
    //             text: "Menu[?display_name=='${OrderItem}'] | [0].sizes[*].name",
    //             action: "JmesPathAction",
    //             affectedContexts: [{
    //                 name: "getMenuItemDetails",
    //                 lifespanCount: 3 // max of 99 conversation turns
    //             }],
    //             actionResponse: "We have it in ${actionOutput}"
    //         },
    //         {
    //             text: "Menu[?display_name=='${OrderItem}'] | [0].sizes[*].addPrice",
    //             action: "JmesPathAction",
    //             resetContexts: "mine",
    //             affectedContexts: [{
    //                 name: "getMenuItemDetails",
    //                 lifespanCount: 3 // max of 99 conversation turns
    //             }],
    //             actionResponse: "which cost ${actionOutput}"
    //         }
    //     ]
    // },
    // {
    //     id: "askPriceWithSize",
    //     utterances: [
    //         "how much is ${Size} ${OrderItem}?",
    //         "what is the price of ${OrderItem} ${Size}"
    //     ],
    //     entities: [
    //         "OrderItem@MenuItems",
    //         "Size@MenuItemSizes"
    //     ],
    //     responses: [
    //         {
    //             text: "Menu[?display_name=='${OrderItem}'] | [0].sizes[?name=='${Size}'] | [0].addPrice",
    //             action: "JmesPathAction",
    //             actionResponse: "${Size} ${OrderItem} costs ${actionOutput}.",
    //             resetContexts: "mine"
    //         }
    //     ]
    // },
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
        "OrderItem@MenuItems",
        "Size@MenuItemSizes",
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
    // {
    //     id: "removeOrderItem",
    //     utterances: [
    //       "sorry can you cancel the ${OrderItem}",
    //       "cancel ${OrderItem}",
    //       "changed my mind about ${OrderItem}",
    //       "remove ${OrderItem} from my order"
    //     ],
    //     entities: [
    //       "OrderItem@MenuItems",
    //     ],
    //     responses: [
    //       {
    //         text: "I have removed ${OrderItem} from your order",
    //         affectedContexts: [{
    //             name: "hasOrder",
    //             lifespanCount: 99 // max of 99 conversation turns
    //         }],
    //         removeObjectInArray: {
    //             OrderItems: {
    //                 key: "OrderItem",
    //                 value: "${OrderItem}"
    //             }
    //         }
    //       }
    //     ]
    // },
    {
      id: "endOrder",
      inputContexts: ["hasOrder"],
      utterances: [
        "No, that's all",
        "no",
        "nope",
        "nope ${Polite}",
        "nope, thats it",
        "No ${Polite}",
        "I'm done",
        "Nothing else for now",
        "thats all",
        "thats all ${Polite}",
        "thats it",
        "thats it ${Polite}"
      ],
      required_entities: ["OrderItems"],
      noFills: ["Polite@Polite"],
      responses: [
        {
          text: "OrderItems[*].[Quantity, Size, OrderItem]",
          action: "JmesPathAction",
          actionResponse: "You have ordered ${actionOutput}", //@TODO actionOutput is written to session
          affectedContexts: [
            {
              name: "hasOrder",
              lifespanCount: 99 // max of 99 conversation turns
            }
          ]
        },
        {
          text: "NOTUSED",
          action: "JsonLogicAction",
          actionConfig: {
            calculateOrderPrice: [{ var: "OrderItems" }, { var: "Menu" }]
          },
          actionResponse: "Your total order amount is $${actionOutput}",
          affectedContexts: [
            {
              name: "hasOrder",
              lifespanCount: 99 // max of 99 conversation turns
            }
          ],
          resetContexts: true
        }
      ]
    }
    // {
    //     id: "menuQueryByIngredients",
    //     utterances: [
    //         "what do you have that contains",
    //         "do you have vegetarian"
    //     ],
    //     entities: [],
    //     responses: [
    //         {
    //             text: "depre function use objectmap",
    //             // action: "menuQueryByIngredients",
    //             // actionResponse: "we have ${actionOutput}, which ones would you like to hear more about?"

    //         }
    //     ]

    // },
  ],
  EntityFills: [
    {
      name: "OrderItem",
      mappedTo: "MenuItems",
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
          jmesPath: "MenuItems",
          noSuggestRes:
            "We do not sell ${OrderItem}. What item would you like to order?",
          suggestRes: "Did you want to order ${topSuggest}?" // topSuggest hardcoded into mapping handler
        },
        // {
        //     onlyForIntents: ["removeOrderItem"],
        //     jmesPath: "OrderItems[?OrderItem='${detectedEnt.value}']",
        //     noSuggestRes: "You do not have an order of ${detectedEnt.value}",
        //     suggestRes: "Did you want to cancel ${topSuggest}?", // topSuggest hardcoded into mapping handler
        // },
        {
          onlyForIntents: ["getMenuItemDetails"],
          jmesPath: "MenuItems",
          noSuggestRes:
            "We do not have ${OrderItem} on our menu. What item would you like to know more about?",
          suggestRes: "Did you mean ${topSuggest}" // topSuggest hardcoded into mapping handler
        }
      ],
      responses: [
        {
          onlyForIntents: ["makeOrder"],
          text: "What item would you like to order?"
        },
        {
          onlyForIntents: ["getMenuItemDetails"],
          text: "What item would you like to know more about?"
        }
      ] // handles no entity slot in
    },
    {
      name: "Size",
      mappedTo: "MenuItemSizes",
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
            "Menu[?display_name=='${OrderItem}'].sizes[*].{value: name, synonyms: synonyms} | [0]",
          noSuggestRes:
            "it is not available in ${Size}. ${OrderItem} is available in ${actionOutput}, what would you like?",
          suggestRes: "Did you mean ${topSuggest}"
        }
      ],
      responses: [
        {
          text: "Menu[?display_name=='${OrderItem}'].sizes[].name | []",
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
          text: "Menu[?display_name=='${OrderItem}'] | [0].sizes[?name=='${Size}'] | [0].addPrice",
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
