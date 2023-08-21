import {
  getIntent,
  getMappedParams,
  handleOverwriteSlots,
  isPrimitiveIntent,
  matchIntent,
  processResponses,
  processSessionWithResponses,
  resetContextsSession,
  toLowerCaseObj,
  validateIntentEntities
} from "./Utils";
import { RasaEntitiy, RasaResponse } from "./rasa";
import {
  CustomerSettings,
  Session,
  Response,
  Intent,
  RasaSlot,
  RasaDetectedEntity,
  TrackerEvent,
  UserTrackerEvent
} from "./types";
import { v4 as uuid } from "uuid";
import jsonLogic from "json-logic-js";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { mergeRepeatedEntities, sortRasaEntities } from "./RasaUtils";
import { Db, DbStatsOptions, MongoClient } from "mongodb";

export async function synthesizeSpeech(text: string) {
  const ttsClient = new TextToSpeechClient();
  const request = {
    audioConfig: {
      audioEncoding: "MP3",
      effectsProfileId: ["medium-bluetooth-speaker-class-device"],
      pitch: 0,
      speakingRate: 1.19
    },
    input: {
      ssml: text
    },
    voice: {
      languageCode: "en-GB",
      name: "en-GB-Wavenet-F"
    }
  } as any;

  // Make the API request
  const voice = await ttsClient.synthesizeSpeech(request);

  if (!voice[0].audioContent) throw new Error("tts broke");
  return new Buffer(voice[0].audioContent as any).toString("base64");
}
const connectionString =
  "mongodb://127.0.0.1:27017,127.0.0.1:27018,127.0.0.1:27019/?replicaSet=myReplicaSet";

const client = new MongoClient(connectionString);
export async function processMsg(
  customer: CustomerSettings,
  txt: string,
  session?: Session
): Promise<[Response[], Session, UserTrackerEvent[]]> {
  console.log("processMsg", txt);

  // set default session
  if (!session) {
    session = {
      _id: uuid(),
      Entities: {},
      lastIntent: "Root",
      affectedContexts: [],
      tracker: []
    } as Session;
  }
  const eventId = uuid();

  // lowercase for rasa + rasaAction

  if (["rasa", "rasaAction"].includes(customer.nlu)) {
    txt = txt.toLowerCase();
    customer.SalesItems = toLowerCaseObj(customer.SalesItems);
  }

  // get NLUIntent

  let NLUIntent;
  if (customer.nlu === "rasa") {
    NLUIntent = (await getIntent(customer, txt, session)) as RasaResponse;
  } else throw new Error("only rasa supported");
  if (!NLUIntent) throw new Error("no NLUIntent");

  let bestIntent: Intent;
  [bestIntent, NLUIntent] = getBestIntentRasa(customer, session, NLUIntent);
  console.log("got bestIntent", bestIntent.id, NLUIntent.intent);
  // inject undetected ents for askRes
  if (
    NLUIntent.intent.name.startsWith("askRes_") &&
    NLUIntent.entities.length === 0
  ) {
    NLUIntent.entities.push({
      entity: NLUIntent.intent.name.replace("askRes_", ""),
      start: 0,
      end: txt.length,
      confidence_entity: 1,
      value: txt,
      extractor: "OpenB"
    });
  }

  // catch affirm/deny use cases
  const userTrackers: UserTrackerEvent[] = [];
  if (NLUIntent.intent && isPrimitiveIntent(NLUIntent.intent.name, true)) {
    // affirm/deny only for when topSuggest exists
    if (session.Entities.activeIntent) {
      // topSuggest affirm/deny
      if (session.Entities.topSuggestSlotKey) {
        if (NLUIntent.intent.name === "Affirm") {
          console.log(
            "affirm topSuggestKey",
            session.Entities.topSuggestSlotKey
          );
          session.tracker.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "Affirm_topSuggest_" + session.Entities.topSuggestSlotKey
          });
          userTrackers.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "Affirm_topSuggest_" + session.Entities.topSuggestSlotKey,
            text: txt,
            date: new Date(),
            detectedEnts: NLUIntent.entities
          });
          // set value to topSuggest
          session.Entities[session.Entities.topSuggestSlotKey] =
            session.Entities.topSuggest;
          session.Entities.topSuggest = null;
          session.Entities.topSuggestSlotKey = null;
          session.Entities.requested_slot = null;
          session.Entities.activeIntent = null;
        } else if (NLUIntent.intent.name === "Deny") {
          // console.log("Deny", session,request.tracker )
          session.tracker.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "Deny_topSuggest_" + session.Entities.topSuggestSlotKey
          });
          userTrackers.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "Deny_topSuggest_" + session.Entities.topSuggestSlotKey,
            text: txt,
            date: new Date(),
            detectedEnts: NLUIntent.entities
          });
          // set value to topSuggest
          session.Entities.topSuggest = null;
          session.Entities.topSuggestSlotKey = null;
          session.Entities.activeIntent = null;
          /// all intents are assumed to have entities because it shouldnt go into validate otherwise
          if (
            !session.Entities.requested_slot.startsWith(bestIntent.id + "_")
          ) {
            throw new Error(
              "deny got unexpected requested slot " +
              session.Entities.requested_slot
            );
          }
          const matchedEntityFill = customer.EntityFills.find(
            (entityFill) =>
              entityFill.name ===
              session?.Entities.requested_slot.replace(bestIntent.id + "_", "")
          );
          if (!matchedEntityFill) {
            throw new Error(
              "cant get matchedEntityFill for " +
              session.Entities.requested_slot.replace(bestIntent.id + "_", "")
            );
          }
          const mappedIntentEnts: RasaSlot = {};
          if (!bestIntent.entities) {
            throw new Error(
              "deny expects intent to have entities " + bestIntent.id
            );
          }
          for (const ent of bestIntent.entities) {
            const entKey = ent.split("@")[0];
            if (session.Entities[bestIntent.id + "_" + entKey]) {
              mappedIntentEnts[entKey] =
                session.Entities[bestIntent.id + "_" + entKey];
            }
          }
          session.tracker.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "ask_" + bestIntent.id + "_" + matchedEntityFill.name
          });
          userTrackers.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "ask_" + bestIntent.id + "_" + matchedEntityFill.name,
            text: txt,
            date: new Date(),
            detectedEnts: NLUIntent.entities
          });
          console.log("deny before res", session);
          return [
            processResponses(
              customer,
              session,
              matchedEntityFill.responses,
              Object.assign({}, session.Entities, mappedIntentEnts),
              bestIntent.id
            ),
            session,
            userTrackers
          ];
        } else {
          throw new Error("topSuggest invalid intent" + NLUIntent.intent.name);
        }
      }

      // overwriteSlot affirm/deny
      else if (session.Entities.activeIntent.startsWith("overwriteSlot_")) {
        if (!session.Entities.overwriteSlotValue)
          throw new Error("overwriteslot value not here");
        console.log("affirm/deny overwrite slot", session);
        if (NLUIntent.intent.name === "Affirm") {
          session.tracker.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "Affirm_" + session.Entities.activeIntent
          });
          userTrackers.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "Affirm_" + session.Entities.activeIntent,
            text: txt,
            date: new Date(),
            detectedEnts: NLUIntent.entities
          });
          session.Entities[
            session.Entities.activeIntent.replace("overwriteSlot_", "")
          ] = session.Entities.overwriteSlotValue;
          session.Entities.overwriteSlotValue = null;
          session.Entities.activeIntent = null;
          // validate current slots
          const slotsToValidate: RasaDetectedEntity[] = [];
          const mockSession = JSON.parse(JSON.stringify(session));
          let fakeIndex = 0;
          for (const entKey of Object.keys(session.Entities)) {
            if (entKey.startsWith(bestIntent.id + "_")) {
              slotsToValidate.push({
                entity: entKey.replace(bestIntent.id + "_", ""),
                start: fakeIndex,
                end: fakeIndex,
                confidence_entity: 1,
                extractor: "OpenB_Overwrite",
                value: mockSession.Entities[entKey]
              });
              ++fakeIndex;

              delete mockSession.Entities[entKey];
            }
          }
          console.log("mockSession", mockSession, slotsToValidate);
          const [validateRes, validateSession] = validateIntentEntities(
            customer,
            session,
            bestIntent,
            slotsToValidate,
            eventId
          );
          console.log("validateRes", validateRes, validateSession);
          if (validateRes.length !== 0) {
            return [validateRes, validateSession, userTrackers];
          }
        } else if (NLUIntent.intent.name === "Deny") {
          session.tracker.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "Deny_" + session.Entities.activeIntent
          });
          userTrackers.push({
            _id: eventId,
            intent: bestIntent.id,
            action: "Deny_" + session.Entities.activeIntent,
            text: txt,
            date: new Date(),
            detectedEnts: NLUIntent.entities
          });
          session.Entities.overwriteSlotValue = null;
          session.Entities.activeIntent = null;
        } else
          throw new Error(
            "overwriteSLot wrong intent " + NLUIntent.intent.name
          );
      }
    } else {
      // no topSuggest, going to set it as best Intent now
      NLUIntent.intent.name = bestIntent.id;
    }
  }
  console.log("processMsg just before processIntent", NLUIntent)

  return await processIntent(
    customer,
    session,
    bestIntent,
    NLUIntent,
    eventId,
    userTrackers,
    txt
  );
}

export async function processMsgWithVoice(
  customer: CustomerSettings,
  txt: string,
  session?: Session
) {
  const [responses, newSession, logs] = await processMsg(
    customer,
    txt,
    session
  );

  let allText = "";
  responses.forEach((res) => {
    if (res.text) allText += " " + res.text;
  });
  // return [responses, newSession, logs, await synthesizeSpeech(allText)];
}

export async function logUserSession(
  id: string,
  events: UserTrackerEvent[],
  db: Db
) {
  console.log("log user session", id, events);
  if (events.length === 0) {
    return;
  }
  const sessionCol = db.collection<Session>("UserSessions");
  const result = await sessionCol.updateOne(
    {
      _id: id
    },
    {
      $push: {
        tracker: {
          $each: events
        }
      }
    },
    {
      upsert: true // Add this option to create a new session if it doesn't exist
    }
  );
  if (result.upsertedCount === 1) {
    console.log("Created a new session with the provided tracker event");
  } else if (result.modifiedCount === 1) {
    console.log("Successfully added new tracker event to session");
  } else {
    throw new Error("Failed to add new tracker event to session");
  }
}
export async function endUserSession(id: string, db?: Db) {
  console.log("endUserSession");
  if (!db) {
    return;
  }
  const sessionCol = db.collection<Session>("UserSessions");
  const result = await sessionCol.updateOne(
    { _id: id },
    {
      $set: {
        ended: true
      }
    }
  );
  console.error("result", result);
}
export function getBestIntentRasa(
  customer: CustomerSettings,
  session: Session,
  NLUIntent: RasaResponse
): [Intent, RasaResponse] {
  let i = 0;
  let loopIntent: Intent | undefined;
  let loopDetEnt;
  /// skip below if topIntent is special
  const mergedEntities = mergeRepeatedEntities(NLUIntent.entities);
  console.log("NLUIntent.intent_ranking", NLUIntent.intent_ranking);
  console.log("NLUIntent.ents", NLUIntent.entities);
  while (i < NLUIntent.intent_ranking.length) {
    const detInt = NLUIntent.intent_ranking[i];
    if (detInt.confidence === 0) {
      ++i;
      continue;
    }
    let matchedIntent;
    if (detInt.name === "nlu_fallback") {
      ++i;
      continue;
    }
    if (detInt.name.startsWith("askRes_")) {
      // console.log("askRes bah",detInt,session.Entities.requested_slot,session.Entities.requested_slot?.split("_")[1])
      if (
        !session.Entities.requested_slot ||
        !detInt.name.endsWith(session.Entities.requested_slot.split("_")[1])
      ) {
        const [matchedDetEnts] = mergedEntities.filter((me) => {
          return detInt.name.endsWith(me.entity);
        });
        if (!matchedDetEnts) {
          //   console.log("didnt detect matchedDetEnts")
          ++i;
          continue;
        } else if (session.lastIntent !== "Root") {
          // if detEnt has the right values, return askRes
          //   console.log("askRes switch")
          matchedIntent = matchIntent(customer.Intents, session.lastIntent);
          matchedIntent.confidence = detInt.confidence; // with detEnts, assume its good. not sure
        } else {
          ++i;
          continue;
        }
      } else {
        //   console.log("setting askRes Intent",session.Entities.requested_slot)
        matchedIntent = matchIntent(customer.Intents, session.lastIntent);
        matchedIntent.confidence = detInt.confidence; // @TODO with requested slot, we can assume its good
      }
    } else if (isPrimitiveIntent(detInt.name, true)) {
      // handles only Affirm + Deny here
      if (session.Entities.activeIntent) {
        if (session.Entities.topSuggest) {
          console.log(
            "session.Entities.topSuggest",
            session.Entities.topSuggest
          );
          matchedIntent = matchIntent(customer.Intents, session.lastIntent);
          matchedIntent.confidence = detInt.confidence;
        } else if (session.Entities.activeIntent.startsWith("overwriteSlot_")) {
          const slotInt = session.Entities.activeIntent.split("_")[1];
          if (slotInt !== session.lastIntent) {
            throw new Error("invalid overwriteslot Int");
          }
          matchedIntent = matchIntent(customer.Intents, session.lastIntent);
          matchedIntent.confidence = detInt.confidence;
        } else {
          ++i;
          continue;
        }
      } else {
        console.log("gona skip", detInt);
        ++i;
        continue;
      }
    } else {
      matchedIntent = matchIntent(customer.Intents, detInt.name);
      matchedIntent.confidence = detInt.confidence;
    }

    // handled req ents
    if (matchedIntent.required_entities) {
      let skip = false;
      for (const reqSlot of matchedIntent.required_entities) {
        if (!session.Entities[reqSlot]) {
          skip = true;
        }
      }
      if (skip) {
        ++i;
        continue;
      }
    }
    /// deal with det Ents
    const intentEntKeys =
      matchedIntent.entities?.map((ent) => {
        return ent.split("@")[0];
      }) || [];

    const numEnts = mergedEntities.length;
    for (const detEnt of mergedEntities) {
      if (detEnt.group && detEnt.confidence_group) {
        if (
          detEnt.entity.startsWith(matchedIntent.id + "_") &&
          intentEntKeys.includes(detEnt.group)
        ) {
          matchedIntent.confidence +=
            (detEnt.confidence_entity + detEnt.confidence_group) / 2 / numEnts;
        } else {
          // detected wrong ent, ding it
          matchedIntent.confidence -= 1 / numEnts;
        }
      } else {
        if (intentEntKeys.includes(detEnt.entity)) {
          matchedIntent.confidence += detEnt.confidence_entity / numEnts;
        } else {
          // detected wrong ent, ding it
          matchedIntent.confidence -= 1 / numEnts !== 0 ? numEnts : 1;
        }
      }
    }
    //   console.log("end loopIntent",loopIntent?.id,loopDetEnt)
    if (loopIntent === undefined) {
      loopIntent = matchedIntent;
      loopDetEnt = detInt;
    } else if (
      loopIntent.confidence &&
      loopIntent.confidence < matchedIntent.confidence
    ) {
      loopIntent = matchedIntent;
      loopDetEnt = detInt;
    }
    ++i;
  }

  if (!loopIntent) throw new Error("ts");
  if (!loopDetEnt) throw new Error("ts");


  console.log("getBestIntentRasa", loopIntent, NLUIntent)
  NLUIntent.intent = loopDetEnt;
  // switch to UnknownIntentFallback if Agent.mlMinimumConfidence
  if (loopIntent.confidence && loopIntent.confidence <= customer.Agent.mlMinimumConfidence) {
    loopIntent = customer.UnknownIntentFallback
    NLUIntent.intent = {
      name: "UnknownIntentFallback",
      confidence: customer.Agent.mlMinimumConfidence
    }
  }

  return [loopIntent, NLUIntent];
}

export async function processIntent(
  customer: CustomerSettings,
  session: Session,
  intent: Intent,
  NLUIntent: RasaResponse,
  eventId: string,
  events: UserTrackerEvent[],
  userText: string
): Promise<[Response[], Session, UserTrackerEvent[]]> {
  if (!isValidIntent(intent)) {
    throw new Error("invalid intent");
  }

  // validate slots
  let detectedEnts = mergeRepeatedEntities(NLUIntent.entities);
  detectedEnts = sortRasaEntities(detectedEnts, intent);
  let responses: Response[] = [];

  const overwriteRes = handleOverwriteSlots(
    customer,
    session,
    intent,
    NLUIntent.entities,
    eventId
  );
  console.log("overwriteRes", overwriteRes);
  if (overwriteRes) {
    events.push({
      _id: eventId,
      intent: intent.id,
      action: session.Entities.activeIntent,
      text: NLUIntent.text,
      date: new Date(),
      detectedEnts: NLUIntent.entities
    });
    return [overwriteRes[0], overwriteRes[1], events];
  }

  [responses, session] = validateIntentEntities(
    customer,
    session,
    intent,
    detectedEnts,
    eventId
  );
  session.lastIntent = intent.id;

  if (responses.length !== 0) {
    events.push({
      ...session.tracker[session.tracker.length - 1],
      text: NLUIntent.text,
      date: new Date(),
      detectedEnts: NLUIntent.entities
    });
    return [responses, session, events];
  }
  console.log("after validate", session);
  // slot filling
  [responses, session] = getSlotFilling(customer, session, intent, eventId);
  if (responses.length !== 0) {
    events.push({
      ...session.tracker[session.tracker.length - 1],
      text: NLUIntent.text,
      date: new Date(),
      detectedEnts: NLUIntent.entities
    });

    return [responses, session, events];
  }
  console.log("getSlotFilling session", session, responses);

  // map intentEnts
  const mySlots = JSON.parse(JSON.stringify(session.Entities));
  /// translate intent_ent into ent
  Object.keys(mySlots).forEach((key) => {
    if (key.startsWith(intent.id + "_")) {
      mySlots[key.replace(intent.id + "_", "")] = mySlots[key];
    }
  });
  const responsesToUse = getResponsesToUse(customer, intent);
  console.log(
    "session before process",
    JSON.stringify(session, null, 4),
    mySlots
  );
  session = getMappedParams(customer, session, responsesToUse);
  console.log("session after getmapped", JSON.stringify(session, null, 4));
  const processedResponses = processResponses(
    customer,
    session,
    responsesToUse,
    mySlots,
    undefined,
    userText
  );
  session = resetContextsSession(customer, session, processedResponses);

  // execute action tracker
  session.tracker.push({
    _id: eventId,
    intent: intent.id,
    action: "execute_" + intent.id
  });
  events.push({
    _id: eventId,
    intent: intent.id,
    action: "execute_" + intent.id,
    text: NLUIntent.text,
    date: new Date(),
    detectedEnts: NLUIntent.entities
  });

  // deal with if there is an outstanding context
  const [interruptedRes, interruptedSession] = getInterruptedIntent(
    customer,
    session,
    eventId
  );
  if (interruptedRes.length !== 0) {
    processedResponses.push(...interruptedRes);
    session = interruptedSession;

    events.push({
      ...session.tracker[session.tracker.length - 1],
      text: NLUIntent.text,
      date: new Date(),
      detectedEnts: NLUIntent.entities
    });
  }
  return [processedResponses, session, events];
}

export function getInterruptedIntent(
  customer: CustomerSettings,
  session: Session,
  eventId: string
): [Response[], Session] {
  console.log("getInterruptedIntent", session.tracker);
  const returnRes: Response[] = [];
  const reversedTracker = JSON.parse(JSON.stringify(session.tracker));
  reversedTracker.reverse();

  const currentEvent = reversedTracker.find(
    (event: TrackerEvent) => event._id == eventId
  );
  let lastEvent;
  if (!currentEvent) {
    lastEvent = reversedTracker.find(
      (event: TrackerEvent) => event._id !== eventId
    );
  } else {
    lastEvent = reversedTracker.find(
      (event: TrackerEvent) =>
        event._id !== eventId && event.intent !== currentEvent.intent
    );
  }

  if (!lastEvent || lastEvent.action.startsWith("execute_")) {
    return [returnRes, session];
  }

  if (lastEvent.action.startsWith("ask_")) {
    const lastIntent = lastEvent.action.split("_")[1];
    const lastEnt = lastEvent.action.split("_")[2];
    console.log("lastIntent", lastIntent, lastEnt);
    // ask for entity
    const matchedEntityFill = customer.EntityFills.find(
      (entityFill) => entityFill.name === lastEnt
    );
    if (!matchedEntityFill) {
      throw new Error("cant find matchedEntityFill " + lastEnt);
    }
    const mySlots = JSON.parse(JSON.stringify(session.Entities));
    /// translate intent_ent into ent
    Object.keys(mySlots).forEach((key) => {
      if (key.startsWith(lastIntent + "_")) {
        mySlots[key.replace(lastIntent + "_", "")] = mySlots[key];
      }
    });
    session.Entities.requested_slot = lastIntent + "_" + lastEnt;
    session.lastIntent = lastIntent;
    session.tracker.push({
      _id: eventId,
      intent: lastIntent,
      action: lastEvent.action
    });

    returnRes.push({
      text: `<break time='1s'/>`
    });
    returnRes.push(
      ...processResponses(
        customer,
        session,
        matchedEntityFill.responses,
        mySlots,
        lastIntent
      )
    );
  } else {
    console.error("getInterruptedIntent needs to deal with", lastEvent);
  }
  return [returnRes, session];
}
export function getResponsesToUse(
  customer: CustomerSettings,
  intent: Intent
): Response[] {
  let responsesToUse: Response[] = [];
  if (intent.if) {
    const { booleanCondition } = intent.if;
    if (
      !booleanCondition?.true?.responses ||
      !booleanCondition?.false?.responses
    ) {
      throw new Error("if only supports booleanCondiition now");
    }

    const isTrue = jsonLogic.apply(booleanCondition.condition, customer);
    // handle errors when we are not supplied the expected entities in nlucontexts
    if (!["rasa", "rasaAction"].includes(customer.nlu)) {
      throw new Error("Not handled for not rasa yet!!");
    }
    if (isTrue) {
      responsesToUse = booleanCondition.true.responses;
    } else {
      responsesToUse = booleanCondition.false.responses;
    }
    // return isTrue ? processResponses(booleanCondition.true.responses, settings, NLUContexts) : processResponses(booleanCondition.false.responses, settings, NLUContexts)
  } else if (intent.responses) {
    responsesToUse = intent.responses;
    // return processResponses(intent.responses, settings, NLUContexts)
  } else {
    throw new Error("intent doesnt have if or responses");
  }
  return responsesToUse;
}
export function isValidIntent(intent: Intent): boolean {
  if (isPrimitiveIntent(intent.id)) {
    return true;
  }

  return !!(
    (intent.if && !intent.responses) ||
    (!intent.if && intent.responses) ||
    intent.entities ||
    intent.noFills
  );
}

export function getSlotFilling(
  customer: CustomerSettings,
  session: Session,
  intent: Intent,
  eventId: string
): [Response[], Session] {
  if (intent.entities) {
    for (const ent of intent.entities) {
      const entKey = ent.split("@")[0];
      if (!session.Entities[intent.id + "_" + entKey]) {
        // ask for entity
        const matchedEntityFill = customer.EntityFills.find(
          (entityFill) => entityFill.name === entKey
        );
        if (!matchedEntityFill) {
          throw new Error("cant find matchedEntityFill " + entKey);
        }
        const mySlots = JSON.parse(JSON.stringify(session.Entities));
        /// translate intent_ent into ent
        Object.keys(mySlots).forEach((key) => {
          if (key.startsWith(intent.id + "_")) {
            mySlots[key.replace(intent.id + "_", "")] = mySlots[key];
          }
        });
        console.log("requested slot setting", session.Entities.requested_slot);
        session.Entities.requested_slot = intent.id + "_" + entKey;
        session.tracker.push({
          _id: eventId,
          intent: intent.id,
          action: "ask_" + session.Entities.requested_slot
        });
        return [
          processResponses(
            customer,
            session,
            matchedEntityFill.responses,
            mySlots,
            intent.id
          ),
          session
        ];
      } else {
        session.Entities.requested_slot = null; // @TODO not sure if this is the right place
      }
    }
  }
  return [[], session];
}
