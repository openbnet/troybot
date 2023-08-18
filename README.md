# TroyBot :guide_dog:

## A framework to develop voice chatbots.

TroyBot is a highly opionated framework that allows you to easily build chatbots.

It utilizes nats.io to handle discovery and communication between the various services, including public facing endpoints.
This allows for easy distribution of service hosting, especially for the AI models.

## Current features - how you can use it today

| Task                                   | Status     | Notes                 |
| -------------------------------------- | ---------- | --------------------- |
| Generate Dialogflow config             | ✅         | depreciated\*         |
| Generate Rasa config                   | ✅         | npm run Rasa:Generate |
| Train Rasa NLU model                   | ✅         | npm run Rasa:Generate |
| DevDeploy Rasa NLU model               | ✅         |                       |
| DevDeploy Nats                         | ✅         |                       |
| DevDeploy Whisper STT                  | ✅         |                       |
| DevDeploy Piper TTS                    | ✅         |                       |
| DevDeploy ActionServer                 | ✅         |                       |
| DevDeploy TestWebApp with VAD          | ✅         |                       |
| DevDeploy Tortise TTS                  | Prototyped |                       |
| Custom train Whisper STT               | Prototyped |                       |
| Custom train Tortise STT               | Prototyped |                       |
| Document Customer config options       | Planned    |                       |
| Custom train Piper TTS                 | Planned    |                       |
| Use LLM to improve NLU config          | Planned    |                       |
| LLM fallback for when NLU sucks        | Planned    |                       |
| 1:Many Agent webapp to assist bot live | Planned    |                       |
| Production deploy                      | Planned    |                       |

Tasks follow Planned > Prototyped > ✅

### depreciated\*

Dialogflow's workflow config doesnt allow for easy looping to cover many common conversation loop use cases.
It also only returns top matching intent, which limits the post processing that can be done.

# Usage

First, configure your client in ./client/Customer.ts

```
npm i
npm run Rasa:Generate
docker compose up
```

You should be able to go to http://localhost:3000

### Tested hardware

| Service        | Macbook Pro M1 16GB Ram           | 16Core 64GB ram 4090 lambdastack |
| -------------- | --------------------------------- | -------------------------------- |
| Whisper-medium | runs on cpu > 15s per s of voice. | milliseconds with cuda           |
| Rasa           | runs on cpu fine                  | runs on cpu fine                 |
| Piper TTS      | runs on cpu fine                  | runs on cpu fine                 |
| Tortise TTS    | x                                 | 1s for 1s of voice on cuda       |

### Real estate UnitDetails

```
UnitDetails: {
    Size: "2000",
    AskingPricePSF: "1500"
}

```

### Real estate Intents

The main templating features revolve around https://jmespath.org/ and https://jsonlogic.com/operations.html

```
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
            text: "UnitDetails.size",
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
                text: "UnitDetails.AskingPricePSF",
                action: "JmesPathAction",
                actionResponse: "This unit is ${actionOutput} per square foot"
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
                    "*": [{ var: "UnitDetails.Size" }, { var: "UnitDetails.AskingPricePSF" }]
                },
                actionResponse: "The owner is asking for $${actionOutput}",
            }
        ]
    },
]
```


### Configuring Customer.ts

#### Intent

id: Unique string

utterances: ways user can ask the question, supply 3 - 10 different ways of asking the same thing

entities: this is to define the entities that are expected to be supplied in the user input. If the user does not input the entity, it will go to the EntityFill loop to request the input from the user.

noFills: this is like entities, except that it would not go to the entityfill loop if not included. This allows us to include these entities into the utterance templating engine, but we do not need it in our actual r 

required_entities: intent would only be matched if the user's global state has such entities stored. 


inputContexts: depre - used for dialogflow. required_entities is used instead

if: allows if paths, might depre and use JsonLogic in responses instead

responses: Response[][] - details below

childIntents: define Intents that are dependent on the user being in the current intent flow. 


#### Response


text: if used without action, text would be the response


Array of responses would be concatted into one response string
```
        responses: [
            {
                text: "Menu[?display_name=='${OrderItem}'] | [0].sizes[*].name",
                action: "JmesPathAction",
                affectedContexts: [{
                    name: "getMenuItemDetails",
                    lifespanCount: 3 // max of 99 conversation turns
                }],
                actionResponse: "We have it in ${actionOutput}"
            },
            {
                text: "Menu[?display_name=='${OrderItem}'] | [0].sizes[*].addPrice",
                action: "JmesPathAction",
                resetContexts: "mine",
                affectedContexts: [{
                    name: "getMenuItemDetails",
                    lifespanCount: 3 // max of 99 conversation turns
                }],
                actionResponse: "which cost ${actionOutput}"
            }
        ]
```

This would become 'We have it in small and medium which costs $5 and $10




action?: when action is used, the response would be in actionResponse. Currently only support JmesPathAction and JsonLogicAction

mapParamToObject: This takes detected entities and stores it to global state as an Object
```
          mapParamToObject: {
            LastOrderItem: {
              OrderItem: "makeOrder_OrderItem",
              Size: "makeOrder_Size",
              Quantity: "makeOrder_Quantity"
            }
          },
```

storeObjectInArray: this takes global state objects, and stores it as an array
```

          storeObjectInArray: {
            OrderItems: "LastOrderItem"
          }
```
