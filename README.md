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
                text: "UnitDetails.AskingPricePSF",
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
