## Dev

setup your serviceAccount.seed file with your service account json key
setup your .env file like .env-template

```
npm install
npm restoreDialogflow
npm run test framework
```

## architecture

### SaaSInfra

### SharedSIPWatcher - Receiption

    - [] watches for new inbound phone calls from twillio
        - watches ALL phone numbers in our account
        - passes Customer object downstream?
    - [] spawns a CustomerSessionWorker for the appropirate customer

### CustomerSessionWorker

    - [] twillio STT
    - [] sends text to NLU and gets back intent match
    - [] extract Responses obj from intent
    - [] process all use cases of Responses
        - send direct to txt
            - handle templating
        - send to Twillio TTS
        - do custom action
            - telegram notification for resturant to know they received an order
            - any custom functions that need to execute (used only when "if" doesnt work, try and extend it!)
        - End Session and die
    - [] audiocodes socket connection for initating speech, not in response to user speach

### 3rd party services

    - SIP: Twillio
    - STT: Twillio
    - NLU: Google
    - TTS: Twillio

### new suggestion

Twillio > Dialogflow > intents out to us, we respond with response to dialogflow

### whats needed in dialogflow

intents - utterances
entities

!responses

twillio SIP ->
Audiocodes text > /bot // handles everything
res: string

server - handles chatbotClient's backend - handles dialogflowES query responses (ChildIntents)

client - phone number - webchat bot \*vNext

deepgram

- STT

AWS

Google

Twillio - native integration to providers - phone number and PBX

3cx - need - phone number and PBX

Audiocodes - voice prefilter - native integration to providers - phone number and PBX

MVP - Query - 2-3 types

    - Make order
        - orders get sent to a comms channel of sorts. (telegram, whatsapp)


    - Query exisiting order


    - Modify exisiting

    - **stretchgoal payment

Replicate CX model in our backend mechanism

INTENTS

- launch Intent (Twillio)

  - hello, i'm a chatbot, i can help you do x y z

- menuQueryByIngredients
  - byStore
- menuQueryByPriceBelow
  - byStore
- makeOrder
  - make payment\*
  - make OrderByStore
- enquireStatus\*
- modifyStatus\*

type Store = {
location:
policies: {

    }

}

backend needs to implement shopping cart system

dialogflow session entities

dialogflow - intent - utterances - entities

solve for FAQ - aws/google has their FAQ AI

# Live Human assisted bot

The main idea is to have a human to be able to be
#1 ask_for_human intent
#2 fallback for when we get low % intent matches?
#3 human take over without needing to speak

## workflow for #1 and #2 with existing logical stop points to handover

1. user triggers ask_for_human intent, thru direct intent or fallback capture
2. human takes over NLU's job essentially, handing the text+path response manually
   1. should be able to click on existing NLU responses and fill in entities?

## workflow for #3

currently, vad filtered speech clips are being sent via a request response pattern.

Live human would not be able to evaluate the input + detected ent/int in order to change the response on the fly. - unless we add a delay timer in there?

We COULD however, switch intent for the last intent. - 'sorry i made a mistake earlier, {new intent}'

#1 user asks for something we detect wrongly
#2 bot responses with wrong intent
#3 part way thru, before the user responds? Live human activates switch intent. - it stops current speech on the browser, and plays new speech.
