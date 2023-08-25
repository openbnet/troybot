### UnknownIntent with call backs

1. user asks a question that is unknown
2. We confirm question with user, and let them know we'll call them back when we get an answer
3. Persistant store of user phone number, and list of questions that needs a callback


4. API for new questions response
    1. Check against persistant store to see if we filled up all the asked questions. make callback if filled.



-- email should be stored in global var, so that it doesnt re-ask
-- phone number
### 3rd party API calls

 - Email API
 - New question API
    - require new utterance mapping to existing Intent

1. can i have pictures of the toilet bowl?

2. can you send me more info?


emailTypes: "General" | "MasterBedroomPictures" | "ToiletBowl" | "FloorPlan"

{
    action: "CallAPI"
    actionConfig: {
        type: "POST",
        url: "https://bah/email"
        to: "user@email.com"
        body: {
            subject: "#19_05_TheLumos Layout details"
        }
    }

}
### Reuse code blocks  - Procedure


 - Email flow



 ## meeting scheudler


 1. user wants a meeting - from intent we know what type of meeting, which indicates how long it takes

 2. system requests for meeting from API, API responses with a list of timing.

 3. we tell the user the avail timing, and asks the user to confirm

    - be smart about timing list
        - concat subsequants meetings, ie... avail on monday from 10am - 4pm.

    


