import { CustomerSettings, DFBackupIntentContext, Intent, SalesItem, SalesItemOrderItem, OutputContext, ParamSettingsField, ParamSettingsObject, RasaDetectedEntity, RasaEvent, RasaSlot, RasaTracker, resetContextsType, Response, Session, Transcript } from "./types";
import jsonLogic from 'json-logic-js';
import jmespath from 'jmespath';
import { google } from "@google-cloud/dialogflow/build/protos/protos";
import { v4 as uuid } from 'uuid';

import { rasaParseMessage, RasaResponse, rasaUserMessage } from "./rasa";
import { findFirstUnfilledParam } from "./EntityFillUtils";
import { getActionOutput, getMainValueFromEntitySynonym, getStandardObjects, getValuesFromEntitySynonym, renderListStrings } from "./BaseDataTransformUtils";
import { sendMessageTelegram } from "./Telegram";
import FuzzySet from "fuzzyset.js";
import { sortRasaEntities, mergeRepeatedEntities } from "./RasaUtils";
import { getEmailLLM } from "./LLM"
import { transformEmailToSpeechText } from "./Email"
import {
  connect,
  NatsConnection,
} from "nats";
export function decodeValue(value: google.protobuf.IValue): any {
  if (value.structValue) {
    return decodeStruct(value.structValue);
  } else if (value.listValue?.values) {
    return decodeList(value.listValue);
  } else if (value.stringValue) {
    return value.stringValue;
  } else if (value.numberValue !== undefined) {
    return value.numberValue;
  } else if (value.boolValue !== undefined) {
    return value.boolValue;
  } else {
    return null;
  }
}
export function decodeList(list: google.protobuf.IListValue): any[] {
  const result: any[] = [];

  if (list && list.values) {
    for (const value of list.values) {
      result.push(decodeValue(value));
    }
  }

  return result;
}

export function decodeStruct(struct: google.protobuf.IStruct | null | undefined): any {
  const result: any = {};

  if (struct && struct.fields) {
    const fields = struct.fields;

    for (const key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        const value = fields[key];
        result[key] = decodeValue(value);
      }
    }
  }

  return result;
}

export function renderString(str: string, settings: object): string {
  const regex = /\${([\w.]+)}/g;
  let result = str;
  let match;
  while ((match = regex.exec(str))) {
    const fullMatch = match[0];
    const key = match[1];
    const value = jmespath.search(settings, key);
    if (typeof value === 'object' && value !== null && 'kind' in value) {
      switch (value.kind) {
        case 'structValue': {
          const structValue = value.structValue;
          const fields = structValue.fields;
          result = result.replace(fullMatch, JSON.stringify(fields));
          break;
        }
        case 'listValue': {
          const listValue = value.listValue;
          const values = listValue.values;
          result = result.replace(fullMatch, JSON.stringify(values));
          break;
        }
        default: {
          result = result.replace(fullMatch, value[value.kind]);
        }
      }
    } else {
      result = result.replace(fullMatch, value);
    }
  }
  return result;
}
export function matchIntent(intents: Intent[], intentId: string): Intent {
  const intent = intents.find((i) => i.id === intentId);
  if (!intent) {
    throw new Error(`Cant get intent: ${intentId}`)
  }
  return intent
}
/// @dev Function to return an array like object.map
export function getJmesPathActionData<T>(path: string, obj: T): any {
  const result = jmespath.search(obj, path)
  if (result == null) {
    console.error("path obj", path, obj)
    throw new Error(`Invalid path: ${path}`)
  }
  // console.log("getJmesPathActionData",JSON.stringify(obj,null,4))
  // console.log("getJmesPathActionData", path, result)
  return result
}

/// @dev JsonLogicAction
// @TODO do this somewhere else

jsonLogic.add_operation('calculateOrderPrice', function (OrderItems: SalesItemOrderItem[], Menu: SalesItem[]) {
  let totalPrice = 0;
  OrderItems.forEach(orderItem => {
    const menuItem = Menu.find(menuItem => menuItem.display_name.toLocaleLowerCase() === orderItem.OrderItem.toLocaleLowerCase());
    if (!menuItem) {
      throw new Error("cant match " + orderItem.OrderItem)
    }
    const size = menuItem.sizes.find(size => size.name.toLocaleLowerCase() === orderItem.Size.toLocaleLowerCase());
    if (size) {
      totalPrice += size.addPrice * orderItem.Quantity;
    }

  });
  return totalPrice;
});
jsonLogic.add_operation('round', function (numInString: string) {
  return Math.round(Number(numInString))
});
jsonLogic.add_operation('jmespath', function (query: string, data: object) {
  // console.log("jmespath operation",  query,data)

  return getJmesPathActionData(query, data)
});
jsonLogic.add_operation('spellcheck', function (query: string, data: object) {
  // console.log("jmespath operation",  query,data)
  return jmespath.search(data, query)
});

function getJsonLogic<T>(query: Record<string, unknown>, obj: T): any {

  // console.log("getJsonLogic", query, jsonLogic.apply(query, obj))
  return jsonLogic.apply(query, obj);
}


const nullContext = {
  name: "DONTEXIST",
  lifespanCount: 0,
}
export async function processResponses(
  settings: CustomerSettings,
  session: Session,
  responses: Response[],
  NLUContexts: OutputContext[] | RasaSlot,
  filterForIntent?: string,
  userText?: string,
): Promise<Response[]> {
  const textResponses: Response[] = [];

  for (const response of responses) {
    if (filterForIntent) {
      if (response.onlyForIntents && !response.onlyForIntents.includes(filterForIntent))
        continue;
    }


    let resSettings = JSON.parse(JSON.stringify(settings))
    if (settings.nlu === "es") {
      for (const affectedContext of response.affectedContexts || [nullContext]) {
        const matchedContextIndex = NLUContexts.findIndex((context: OutputContext) => context.name.endsWith(affectedContext.name.toLowerCase()));

        if (matchedContextIndex === -1) {
          /// this handles the usecase when there is no context and only responses
          if (response.affectedContexts || response.action || response.action || response.actionResponse || response.actionInputs || response.mapParamToObject || response.storeObjectInArray) {
            console.error("response", response)
            console.error("affectedContext", affectedContext)
            if (affectedContext.name !== "DONTEXIST") {
              console.error("NLUContexts", NLUContexts)
              throw new Error("cant find context, you probably didnt update the NLU. npm run restoreDialogflow")
            } else {
              throw new Error("response with no context can only handle simple text")
            }

          }
          textResponses.push({
            text: renderString(response.text, settings),
            resetContexts: response.resetContexts
          })
          continue;
        }
        const matchedContext = (NLUContexts as OutputContext[])[matchedContextIndex];
        resSettings = Object.assign(resSettings, decodeStruct(matchedContext.parameters))
      }
    }
    else if (["rasa", "rasaAction"].includes(settings.nlu)) {

      resSettings = Object.assign(resSettings, NLUContexts as RasaSlot, session.Entities, { userText })
    }
    /// deal with response.booleanCondition

    if (response.booleanCondition) {
      if (jsonLogic.apply(response.booleanCondition, resSettings) == false) {
        continue
      }
    }
    if (response.action) {
      if (response.actionResponse === undefined) {
        throw new Error("action requires actionResponse")
      }
      if (response.action === "JmesPathAction") {
        // console.log("JmesPathAction resSettings",resSettings, response)
        resSettings.actionOutput = getActionOutput(response.text, resSettings, response)
        console.log("resSettings.actionOutput", JSON.stringify(resSettings.actionOutput, null, 4))
        textResponses.push(
          {
            text: renderString(response.actionResponse, resSettings),
            affectedContexts: response.affectedContexts,
            resetContexts: response.resetContexts,
            mapParamToObject: response.mapParamToObject,
            storeObjectInArray: response.storeObjectInArray

          }
        )

      }
      else if (response.action === "JsonLogicAction") {
        if (!response.actionConfig) {
          throw new Error("JsonLogicAction requires actionConfig");
        }
        const objectMapData = getJsonLogic(
          response.actionConfig,
          resSettings
        )
        if (!objectMapData) {
          throw new Error("cant get JsonLogicAction objectMapData")
        }
        if (Array.isArray(objectMapData)) {
          resSettings.actionOutput = renderListStrings(objectMapData)
        } else {
          // we are expecting a jsonobject here for complex queries
          for (const key of Object.keys(objectMapData)) {
            if (Array.isArray(objectMapData[key])) {
              objectMapData[key] = renderListStrings(objectMapData[key])
            }
          }
          resSettings.actionOutput = objectMapData
        }

        textResponses.push(
          {
            text: renderString(response.actionResponse, resSettings),
            affectedContexts: response.affectedContexts,
            resetContexts: response.resetContexts,
            mapParamToObject: response.mapParamToObject,
            storeObjectInArray: response.storeObjectInArray

          }
        )

      }
      else if (response.action === "Email") {
        if (!userText) {
          throw new Error("Email needs userText")
        }
        const nc: NatsConnection = await connect({
          servers: "nats_local:4222",
          user: "web",
          pass: "password"
        });
        const capturedEmail = await getEmailLLM(nc, "falcon7b", userText)

        if (!capturedEmail) {
          textResponses.push({
            text: "What is your email address?"
          })
        } else {
          textResponses.push({
            text: "Can I confirm that your email address is " + transformEmailToSpeechText(capturedEmail)
          })
        }





      }
      else {
        throw new Error("unhandled action " + response.action)
      }
    } else {
      textResponses.push({
        text: renderString(response.text, resSettings),
        affectedContexts: response.affectedContexts,
        resetContexts: response.resetContexts,
        mapParamToObject: response.mapParamToObject,
        storeObjectInArray: response.storeObjectInArray
      })
    }

  }
  return textResponses;
}

export function isPrimitiveIntent(intentId: string, excludeAskRes?: true): boolean {

  if (!excludeAskRes) {
    if (intentId.startsWith("askRes_")) {
      return true
    }
  }

  return ["Affirm", "Deny", "nlu_fallback"].includes(intentId)
}
export function isNoContextSwitchIntent(intentId: string): boolean {


  return ["ResetSession"].includes(intentId)
}
export function slotHasPrimitive(slots: RasaSlot): boolean {
  let retBool = false;
  ["topSuggest"].forEach((s) => {
    if (slots[s]) {
      retBool = true;
    }
  })
  return retBool
}
export function isValidIntent(intent: Intent): boolean {
  if (isPrimitiveIntent(intent.id)) {
    return true
  }

  return !!(
    (intent.if && !intent.responses) ||
    (!intent.if && intent.responses) ||
    intent.entities ||
    intent.noFills
  );
}

export function checkIntentEntitesExist(settings: CustomerSettings, intent: Intent, NLUContexts: OutputContext[] | RasaSlot): true {
  let newContext: OutputContext[] | RasaSlot
  if (!Array.isArray(NLUContexts)) {
    newContext = JSON.parse(JSON.stringify(NLUContexts)) as RasaSlot
    // Object.keys(newContext).forEach((key) => {
    //   if (key.startsWith(intent.id + "_")) {
    //     (newContext as RasaSlot)[key.replace(intent.id + "_", "")] = (newContext as RasaSlot)[key]
    //   }
    // })

  } else {
    newContext = NLUContexts as OutputContext[]
  }
  if (intent.if) {
    const { booleanCondition } = intent.if;
    if (!booleanCondition?.true?.responses || !booleanCondition?.false?.responses) {
      throw new Error("if only supports booleanCondiition now")
    }

    const isTrue = jsonLogic.apply(booleanCondition.condition, settings);
    // handle errors when we are not supplied the expected entities in nlucontexts
    if (!["rasa", "rasaAction"].includes(settings.nlu)) {
      throw new Error("Not handled for not rasa yet!!")
    }
    if (isTrue) {
      const QueryItems = extractQueryItemsFromResponses(booleanCondition.true.responses)
      if (QueryItems) {
        if (!checkEntitiesExists(QueryItems, Object.assign({}, settings, newContext))) {
          throw new Error("cant get entity")
        }
      }

    } else {
      const QueryItems = extractQueryItemsFromResponses(booleanCondition.false.responses)
      if (QueryItems) {
        if (!checkEntitiesExists(QueryItems, Object.assign({}, settings, newContext))) {
          console.error("queryItems", QueryItems, newContext)
          throw new Error("cant get entity")
        }
      }
    }
  } else if (intent.responses) {
    const QueryItems = extractQueryItemsFromResponses(intent.responses)
    if (QueryItems) {

      if (!checkEntitiesExists(QueryItems, Object.assign({}, settings, newContext))) {
        console.error("intent.responses QueryItems", QueryItems)
        console.error("NLUContexts", newContext)
        console.error("settings", settings)
        throw new Error("cant get entity")
      }
    }
  } else {
    throw new Error("intent doesnt have if or responses")
  }
  return true
}

export function validateIntentEntities(settings: CustomerSettings, session: Session, intent: Intent, detEnts: RasaDetectedEntity[], eventId: string): [Response[], Session] {
  let mergedEntities = mergeRepeatedEntities(detEnts)
  mergedEntities = sortRasaEntities(mergedEntities, intent)
  console.log("validate mergedEntities", mergedEntities)
  let retResponses: Response[] = []
  for (const detectedEnt of mergedEntities) {
    const [matchedEntityFill] = settings.EntityFills.filter((ef) => {
      if (detectedEnt.group) {
        return ef.name === detectedEnt.group
      }
      return ef.name === detectedEnt.entity
    })
    if (!matchedEntityFill) {
      if (detectedEnt.entity === "Alchohol" || detectedEnt.entity === "Polite") {
        continue
      }
      throw new Error("cant get matchedEntityFill for " + detectedEnt.entity)
    }
    // console.log("matchedEntityFill",matchedEntityFill.name,session)
    if (matchedEntityFill.validation) {
      // validate only if mapping is defined
      for (const validation of matchedEntityFill.validation) {
        if (validation.onlyForIntents && !validation.onlyForIntents.includes(intent.id)) {
          // console.log("gona skip validation for", validation)
          continue
        }

        const mySlots = JSON.parse(JSON.stringify(session.Entities))
        /// translate intent_ent into ent
        Object.keys(mySlots).forEach((key) => {
          if (key.startsWith(intent.id + "_")) {
            mySlots[key.replace(intent.id + "_", "")] = mySlots[key]
          }
        })
        const combinedData = Object.assign({}, settings, getStandardObjects(settings), mySlots)
        let mappedList = getJmesPathActionData(
          renderString(validation.jmesPath, combinedData),
          combinedData
        )
        console.log("mappedList", mappedList)
        // do fuzzyset to test
        let fuzzySetRes
        if (typeof mappedList[0] === "string") {
          fuzzySetRes = FuzzySet(mappedList).get(detectedEnt.value)
          if (fuzzySetRes) {
            if (fuzzySetRes[0][0] > settings.Agent.fuzzyAutoAcceptConfidence) {
              // fuzzyAutoAcceptConfidence
              session.Entities[intent.id + "_" + detectedEnt.entity] = fuzzySetRes[0][1]
            } else if (fuzzySetRes[0][0] > settings.Agent.mlMinimumConfidence) {
              // topSuggest
              const topSuggest = fuzzySetRes[0][1]
              const actionOutput = getActionOutput(validation.jmesPath, Object.assign({}, combinedData, session.Entities, { topSuggest }))
              retResponses.push({
                text: renderString(
                  validation.suggestRes,
                  Object.assign(combinedData, { topSuggest, actionOutput })
                )
              })
              session.tracker.push({
                _id: eventId,
                intent: intent.id,
                action: "topSuggest_" + intent.id + "_" + detectedEnt.entity
              })
              // set value to topSuggest
              session.Entities[intent.id + "_" + detectedEnt.entity] = null
              session.Entities.topSuggest = topSuggest
              session.Entities.topSuggestSlotKey = intent.id + "_" + detectedEnt.entity
              session.Entities.requested_slot = intent.id + "_" + detectedEnt.entity
              session.Entities.activeIntent = session.lastIntent
            }
          } else {
            // fuzzySet no match
            const actionOutput = getActionOutput(
              validation.jmesPath,
              Object.assign(combinedData, {
                [
                  detectedEnt.entity
                ]: detectedEnt.value
              })
            )
            retResponses.push({
              text: renderString(
                validation.noSuggestRes,
                Object.assign(combinedData, { actionOutput },)
              )
            })
            session.tracker.push({
              _id: eventId,
              intent: intent.id,
              action: "noSuggest_" + intent.id + "_" + detectedEnt.entity
            })
            session.Entities.requested_slot = detectedEnt.entity
            session.Entities[intent.id + "_" + detectedEnt.entity] = null

          }
        } else {

          // check entire list for highest % value first
          const allRes = FuzzySet(getValuesFromEntitySynonym(mappedList)).get(detectedEnt.value)
          console.log("allRes", allRes)
          if (allRes) {
            const topRes = allRes[0]
            const mainValue = getMainValueFromEntitySynonym(mappedList, topRes[1])
            // console.log("mainValue",mainValue)
            if (!mainValue) {
              throw new Error("cant get main value, shouldnt happen as it was checked above")
            }
            if (topRes[0] >= settings.Agent.fuzzyAutoAcceptConfidence) {

              session.Entities[intent.id + "_" + detectedEnt.entity] = mainValue
            }
            else {
              // topSuggest
              const topSuggest = mainValue
              const actionOutput = getActionOutput(validation.jmesPath, Object.assign({}, combinedData, session.Entities, { topSuggest }))
              retResponses.push({
                text: renderString(
                  validation.suggestRes,
                  Object.assign(combinedData, { topSuggest, actionOutput })
                )
              })
              session.tracker.push({
                _id: eventId,
                intent: intent.id,
                action: "topSuggest_" + intent.id + "_" + detectedEnt.entity
              })
              // set value to topSuggest
              session.Entities[intent.id + "_" + detectedEnt.entity] = null
              session.Entities.topSuggest = topSuggest
              session.Entities.topSuggestSlotKey = intent.id + "_" + detectedEnt.entity
              session.Entities.requested_slot = intent.id + "_" + detectedEnt.entity
              session.Entities.activeIntent = session.lastIntent
            }




          } else {
            // fuzzySet no match
            console.log("fuzzySetRes fail", session, detectedEnt)
            const actionOutput = getActionOutput(
              validation.jmesPath,
              Object.assign(combinedData, {
                [
                  detectedEnt.entity
                ]: detectedEnt.value
              })
            )
            console.log("no match actionOutput", JSON.stringify(actionOutput, null, 4))
            session.tracker.push({
              _id: eventId,
              intent: intent.id,
              action: "noSuggest_" + intent.id + "_" + detectedEnt.entity
            })
            retResponses.push({
              text: renderString(
                validation.noSuggestRes,
                Object.assign(combinedData, { actionOutput },)
              )
            })
            session.Entities.requested_slot = detectedEnt.entity
            session.Entities[intent.id + "_" + detectedEnt.entity] = null


          }



        }


      }
    } else {
      throw new Error("need to fill for no validation")
    }

  }
  return [retResponses, session]
}

export async function handleOverwriteSlots(
  settings: CustomerSettings,
  session: Session,
  intent: Intent,
  detEnts: RasaDetectedEntity[],
  eventId: string
): Promise<null | [Response[], Session]> {
  let mergedEntities = mergeRepeatedEntities(detEnts)
  mergedEntities = sortRasaEntities(mergedEntities, intent)
  console.log("mergedEntities", mergedEntities)
  for (const detectedEnt of mergedEntities) {
    const [matchedEntityFill] = settings.EntityFills.filter((ef) => {
      if (detectedEnt.group) {
        return ef.name === detectedEnt.group
      }
      return ef.name === detectedEnt.entity
    })
    if (!matchedEntityFill) {
      console.log("no match ent fill ", detectedEnt)
      if (detectedEnt.entity === "Alchohol" || detectedEnt.entity === "Polite") {
        continue;
      }
      throw new Error("cant get matchedEntityFill for " + detectedEnt.entity)
    }
    if (session.Entities[intent.id + "_" + detectedEnt.entity]) {
      if (matchedEntityFill.overwriteSlot) {
        if (matchedEntityFill.overwriteSlot.type === "ask") {
          let mappedIntentEnts: RasaSlot = {};
          for (const entKey of Object.keys(session.Entities)) {
            if (entKey.startsWith(intent.id + "_")) {
              mappedIntentEnts[entKey.replace(intent.id + "_", "")] = session.Entities[entKey]
            }
          }
          session.Entities.activeIntent = "overwriteSlot_" + intent.id + "_" + detectedEnt.entity
          session.Entities.overwriteSlotValue = detectedEnt.value
          session.lastIntent = intent.id
          session.tracker.push({
            _id: eventId,
            intent: intent.id,
            action: session.Entities.activeIntent
          })
          return [await processResponses(
            settings,
            session,
            [matchedEntityFill.overwriteSlot.response],
            {
              detectedEnt,
              ...mappedIntentEnts
            }

          ), session]
        } else {
          throw new Error("unsupported overwrite slot type " + matchedEntityFill.overwriteSlot.type)
        }
      }
    }

  }
  return null
}
export async function processIntent(settings: CustomerSettings, session: Session, intent: Intent, NLUContexts: OutputContext[] | RasaSlot | RasaResponse, eventId: string): Promise<[Response[], Session]> {
  if (!isValidIntent(intent)) {
    throw new Error("invalid intent")
  }
  const mappedIntentEnts: RasaSlot = {}
  if (settings.nlu === "es") {
    checkIntentEntitesExist(settings, intent, NLUContexts)
  } else if (settings.nlu === "rasaAction") {
    if (intent.entities) {
      for (const ent of intent.entities) {
        const entKey = ent.split("@")[0];
        console.log("NLUContexts", NLUContexts, entKey)
        if (!(NLUContexts as RasaSlot)[intent.id + "_" + entKey]) {
          throw new Error("cant find intent_entitiy " + entKey)
        }
        (mappedIntentEnts as RasaSlot)[entKey] = (NLUContexts as RasaSlot)[intent.id + "_" + entKey]
      }
    }
    checkIntentEntitesExist(settings, intent, Object.assign({}, NLUContexts, mappedIntentEnts))
    NLUContexts = JSON.parse(JSON.stringify(NLUContexts)) as RasaSlot
  } else {
    // "rasa"
    NLUContexts = NLUContexts as RasaResponse
    if (NLUContexts.entities) {
      for (const ent of NLUContexts.entities) {
        if (ent.group) {
          mappedIntentEnts[ent.group] = ent.value;
        } else {
          mappedIntentEnts[ent.entity] = ent.value;
        }

      }
    }
    for (const entKey of Object.keys(session.Entities)) {
      if (entKey.startsWith(intent.id + "_")) {
        mappedIntentEnts[entKey.replace(intent.id + "_", "")] = session.Entities[entKey]
      }
    }


    const overwriteRes = await handleOverwriteSlots(settings, session, intent, NLUContexts.entities, eventId);
    if (overwriteRes) {
      console.log("handleoverwriteslots responses", overwriteRes)
      return [overwriteRes[0], overwriteRes[1]]
    }
    let responses;
    [responses, session] = validateIntentEntities(settings, session, intent, NLUContexts.entities, eventId)
    if (responses.length !== 0) {
      return [responses, session]
    }
    console.log("validate passed", session)
    // redo this to overwrite with validated answers 
    for (const entKey of Object.keys(session.Entities)) {
      if (entKey.startsWith(intent.id + "_")) {
        mappedIntentEnts[entKey.replace(intent.id + "_", "")] = session.Entities[entKey]
      }
    }
    if (intent.entities) {
      for (const ent of intent.entities) {
        const entKey = ent.split("@")[0]
        if (!session.Entities[intent.id + "_" + entKey]) {
          // ask for entity
          const matchedEntityFill = settings.EntityFills.find((entityFill) => entityFill.name === entKey)
          if (!matchedEntityFill) {
            throw new Error("cant find matchedEntityFill " + entKey)
          }
          const mySlots = JSON.parse(JSON.stringify(session.Entities))
          /// translate intent_ent into ent
          Object.keys(mySlots).forEach((key) => {
            if (key.startsWith(intent.id + "_")) {
              mySlots[key.replace(intent.id + "_", "")] = mySlots[key]
            }
          })
          console.log("requested slot setting", session.Entities.requested_slot)
          session.Entities.requested_slot = intent.id + "_" + entKey;
          return [await processResponses(settings, session, matchedEntityFill.responses, mySlots, intent.id), session]
        } else {
          session.Entities.requested_slot = null // @TODO not sure if this is the right place
        }
      }
    }
    checkIntentEntitesExist(settings, intent, Object.assign({}, NLUContexts, mappedIntentEnts))
    NLUContexts = JSON.parse(JSON.stringify(session.Entities)) as RasaSlot
  }
  console.log("NLUContexts", NLUContexts)
  let responsesToUse: Response[] = []
  if (intent.if) {
    const { booleanCondition } = intent.if;
    if (!booleanCondition?.true?.responses || !booleanCondition?.false?.responses) {
      throw new Error("if only supports booleanCondiition now")
    }

    const isTrue = jsonLogic.apply(booleanCondition.condition, settings);
    // handle errors when we are not supplied the expected entities in nlucontexts
    if (!["rasa", "rasaAction"].includes(settings.nlu)) {
      throw new Error("Not handled for not rasa yet!!")
    }
    if (isTrue) {
      responsesToUse = booleanCondition.true.responses
    } else {
      responsesToUse = booleanCondition.false.responses
    }
    // return isTrue ? processResponses(booleanCondition.true.responses, settings, NLUContexts) : processResponses(booleanCondition.false.responses, settings, NLUContexts)
  } else if (intent.responses) {
    responsesToUse = intent.responses
    // return processResponses(intent.responses, settings, NLUContexts)   
  } else {
    throw new Error("intent doesnt have if or responses")
  }
  console.log("responsesToUse", responsesToUse)

  console.log("NLUContexts,mappedIntentEnts", NLUContexts, mappedIntentEnts, session)
  const responses = await processResponses(settings, session, responsesToUse, Object.assign({}, NLUContexts, mappedIntentEnts))
  console.log("processed responses", responses)
  console.log("session before process session", session)
  session = processSessionWithResponses(settings, session, responses, NLUContexts)
  const resetValue = shouldResetContexts(responses)
  if (resetValue) {
    session.lastIntent = intent.id
  }

  // deal with if there is an outstanding context
  console.log("deal with joining context", session)
  if (session.Entities.requested_slot) {
    const joiningIntent = session.Entities.requested_slot.split("_")[0]
    if (session.lastIntent !== joiningIntent) {
      // switching from with ents to full ents
      const entKey = session.Entities.requested_slot.split("_")[1]
      // ask for entity
      const matchedEntityFill = settings.EntityFills.find((entityFill) => entityFill.name === entKey)
      if (!matchedEntityFill) {
        throw new Error("cant find matchedEntityFill " + entKey)
      }
      const mySlots = JSON.parse(JSON.stringify(session.Entities))
      /// translate intent_ent into ent
      Object.keys(mySlots).forEach((key) => {
        if (key.startsWith(joiningIntent + "_")) {
          mySlots[key.replace(joiningIntent + "_", "")] = mySlots[key]
        }
      })
      session.Entities.requested_slot = joiningIntent + "_" + entKey;
      session.lastIntent = joiningIntent
      // responses.push({
      //   text: `<break time='1s'/>`
      // })
      responses.push(
        ...(await processResponses(settings, session, matchedEntityFill.responses, mySlots, joiningIntent))
      )
    }
  }
  console.log("responses", responses, session)
  return [responses, session]
}



export function isSubset<T>(subset: T[], superset: T[]): boolean {
  return subset.every(value => superset.includes(value));
}
/// @dev returns only the first value
export function getEmptyStringValueKey(fields: any): string | undefined {
  for (const key in fields) {
    const value = fields[key];
    if (value.kind === 'stringValue' && value.stringValue === '') {
      return key;
    }
  }
  return undefined;
}


/// @dev we are expecting to just concat the response here,
/// prob have to branch off into diff intent if dialogflow needs it
export function getResponsesFromIntent(intent: Intent): Response[] {
  if (intent.responses) {
    return intent.responses;
  } else if (intent.if?.booleanCondition) {
    return getResponsesFromIntent(intent.if.booleanCondition.true).concat(
      getResponsesFromIntent(intent.if.booleanCondition.false)
    )
  } else {
    throw new Error("intent needs if or responses " + intent.id)
  }
}

export function shouldResetContexts(responses: Response[]): resetContextsType {
  let ret: resetContextsType;
  responses.forEach((res) => {
    if (res.resetContexts) {
      ret = res.resetContexts
    }
  })
  return ret
}

export function getAffectedContexts(responses: Response[]): OutputContext[] {
  let ret: OutputContext[] = [];
  const existsContext: string[] = [];
  responses.forEach((response) => {
    if (response.affectedContexts) {
      for (const context of response.affectedContexts) {
        if (!existsContext.includes(context.name)) {
          existsContext.push(context.name)
          ret.push(context)
        }
      }
    }
  })
  return ret;
}
export function convertAffectedContextsToDF(contexts: OutputContext[]): DFBackupIntentContext[] {
  return contexts.map((context) => {
    return {
      name: context.name,
      lifespan: context.lifespanCount,
      parameters: context.parameters
    }
  })
}

export function getMappedParams(customer: CustomerSettings, session: Session, responses: Response[]): Session {
  console.log("getMappedParams", session.Entities)
  for (const response of responses) {
    if (customer.nlu === "es") {
      for (const affectedContext of response.affectedContexts || []) {
        console.log("affectedContext", affectedContext)
        const matchedContextIndex = session.affectedContexts.findIndex(context => context.name.endsWith(affectedContext.name.toLowerCase()));

        if (matchedContextIndex === -1) {
          throw new Error(`Failed to find a matching context for ${affectedContext.name}`);
        }

        const matchedContext = session.affectedContexts[matchedContextIndex];
        const parameters = matchedContext.parameters ?? { fields: {} };
        // Map the parameters to objects
        if (response.mapParamToObject) {

          for (const [objectKey, objectFields] of Object.entries(response.mapParamToObject)) {
            const structValue: google.protobuf.IStruct = { fields: {} };
            if (!parameters.fields) {
              throw new Error("session context isn't IStruct")
            }
            for (const [fieldKey, templateValue] of Object.entries(objectFields)) {
              const value = parameters.fields[templateValue];
              if (!value) {
                throw new Error(`No value found for template value ${templateValue}`);
              }

              structValue.fields![fieldKey] = value;
            }

            if (!parameters.fields) {
              parameters.fields = {};
            }

            parameters.fields[objectKey] = {
              kind: "structValue",
              structValue,
            } as google.protobuf.Value;
          }
          session.affectedContexts[matchedContextIndex].parameters = parameters;
        }

        // Store object in array
        if (response.storeObjectInArray) {
          for (const [objectArrayKey, sessionObjectKey] of Object.entries(response.storeObjectInArray)) {
            const matchedContextIndex = session.affectedContexts.findIndex(context => context.parameters?.fields?.[sessionObjectKey]);
            if (matchedContextIndex === -1) {
              throw new Error(`Failed to find a matching context for ${sessionObjectKey}`);
            }
            const matchedContext = session.affectedContexts[matchedContextIndex];
            const matchedValue = matchedContext.parameters!.fields![sessionObjectKey];
            const objectToStore = matchedValue
            const parameters = objectToStore.structValue?.fields ?? {};
            if (parameters[objectArrayKey]) {
              console.log("parameters[objectArrayKey] exists", parameters[objectArrayKey])
              throw new Error("need to append to current")
            } else {
              const listValueObject: google.protobuf.Value = {
                kind: "listValue",
                listValue: {
                  values: [matchedValue]
                },
              } as google.protobuf.Value;
              // parameters[objectArrayKey] = listValueObject;
              matchedContext.parameters!.fields![objectArrayKey] = listValueObject;
            }


          }
        }

      }
    } else if (["rasa", "rasaAction"].includes(customer.nlu)) {
      if (response.mapParamToObject) {

        for (const [objectKey, objectValue] of Object.entries(response.mapParamToObject)) {
          if (!session.Entities[objectKey]) {
            session.Entities[objectKey] = {}
          }
          for (const fieldKey of Object.keys(objectValue)) {
            const refKey = objectValue[fieldKey]
            if (!session.Entities[refKey]) {
              throw new Error("session entities does not have " + refKey)
            }
            session.Entities[objectKey][fieldKey] = JSON.parse(JSON.stringify(session.Entities[refKey]))
          }

        }
      }

      // // Store object in array
      if (response.storeObjectInArray) {
        for (const [objectKey, objectValueKey] of Object.entries(response.storeObjectInArray)) {
          if (!session.Entities[objectKey]) {
            session.Entities[objectKey] = JSON.parse(JSON.stringify([session.Entities[objectValueKey]]))
          } else {
            session.Entities[objectKey].push(session.Entities[objectValueKey])
          }
        }
      }

      // removeObjectInArray
      if (response.removeObjectInArray) {
        for (const [objectKey, objectValueKey] of Object.entries(response.removeObjectInArray)) {
          if (!session.Entities[objectKey]) {
            throw new Error("cant find removeObjectInArray " + objectKey)
          } else {
            // session.Entities[objectKey] = session.Entities[objectKey].filter((obj) => {
            //   if (obj[])
            // })
            throw new Error("bah")

          }
        }
      }
    } else {
      throw new Error("unsupported nlu " + customer.nlu)
    }

  }
  return session;
}


export function resetContextsSession(customer: CustomerSettings, session: Session, responses: Response[]): Session {
  const resetValue = shouldResetContexts(responses)
  // only handling for rasa now
  console.log("resetContextsSession", session, resetValue)
  if (resetValue === true) {
    Object.keys(session.Entities).forEach((eKey) => {
      session.Entities[eKey] = null
    })
  } else if (resetValue === "mine") {
    const intent = matchIntent(customer.Intents, session.lastIntent)
    if (!intent) {
      throw new Error("cant get intent for " + session.lastIntent)
    }
    if (!intent.entities) {
      throw new Error("reset mine needs intent entities " + intent.id)
    }
    for (const ent of intent.entities) {
      session.Entities[intent.id + "_" + ent.split("@")[0]] = null
    }
  }
  return session
}
export function processSessionWithResponses(customer: CustomerSettings, session: Session, responses: Response[], NLUAffectedContexts: OutputContext[] | RasaSlot): Session {
  if (!session.affectedContexts) {
    throw new Error("ts wants this")
  }
  if (customer.nlu === "es") {
    session.affectedContexts = NLUAffectedContexts as OutputContext[];
  }
  else if (["rasa", "rasaAction"].includes(customer.nlu)) {
    console.log("process session NLUAffectedContexts", NLUAffectedContexts)
    Object.keys(NLUAffectedContexts as RasaSlot).forEach((key) => {
      session.Entities[key] = (NLUAffectedContexts as RasaSlot)[key]
    })
    console.log("before getmapped", session)
    session = getMappedParams(customer, session, responses);
    console.log("after getmapped", session)
    session = resetContextsSession(customer, session, responses)
  } else {
    throw new Error("unsupported nlu " + customer.nlu)
  }

  return session

}



// export async function processMessage(
//   customer: CustomerSettings,
//   text: string,
//   session?: Session,
// ): Promise<[Response[], Session]> {
//   if (["rasa", "rasaAction"].includes(customer.nlu)) {
//     console.log("text",text)
//     text = text.toLowerCase()
//     customer.Menu = toLowerCaseObj(customer.Menu)
//   }
//   if (!session) {
//       session = {
//           id: uuid(),
//           Entities: {},
//           lastIntent: 'Root',
//           affectedContexts: [],
//           tracker: []
//       } as Session
//   }
//   if (customer.nlu === "rasaAction") {
//     let responses = await rasaUserMessage(session, text, customer.Agent.rasaOptions)
//     if (responses.length === 0) {
//       console.error("didnt get response from rasa gona retry", text, session)



//       responses = await rasaUserMessage(session, text, customer.Agent.rasaOptions)
//       if (responses.length === 0) { 
//         console.error("retry failed")
//         await sendMessageTelegram(customer, 
//             "Didnt get response from rasa: \n" +
//             "user: " + text + "\n" +
//             "session:" + JSON.stringify(session,null,4)  
//         )
//         return [
//           [{text: "Sorry can you say it in another way?"}],
//           session
//         ]
//       }


//     }
//     if (responses.length < 2) {
//       console.error('responses', JSON.stringify(responses,null,4))
//       console.error("session", session, text)
//       if (responses[0].text === "Okay I have reset your session") {
//           // @TODO map it to the right thing 
//           session.id = uuid()
//       } else {
//         session.id = "useLast"
//       }


//       return [responses,session]
//     }
//     // overwrite session, latest res wins
//     responses.forEach((res) => {
//       if (res.custom) {
//         session = res.custom
//       }
//     })

//     session = processSessionWithResponses(customer, session, responses, {})

//     console.log("session",session)


//     return [responses, session]
//   }
//   else if (customer.nlu === "es") {
//     let NLUIntent = await getIntent(customer,text,session) as IQueryResult | null
//     if (!NLUIntent) {
//       // no intents detected, go to default path
//       return [[{
//           text: customer.hello.text
//       }], session];
//     }
//     if (!NLUIntent.intent?.displayName) {
//         throw new Error("NLUIntent doesnt have displayName")
//     }
//     // console.log("NLUIntent",JSON.stringify(NLUIntent,null,4))
//     // console.log("NLUIntent",NLUIntent.queryText,NLUIntent.intent?.displayName, NLUIntent.parameters, NLUIntent.intentDetectionConfidence)
//     if (!NLUIntent.parameters?.fields) {
//         throw new Error("NLUIntent has no params")
//     }
//     const NLUContext: OutputContext[] = !NLUIntent.outputContexts ? [] : NLUIntent.outputContexts as OutputContext[]
//     // console.log("NLUContext", JSON.stringify(NLUContext,null,4))
//     session.lastIntent = NLUIntent.intent.displayName
//     const firstUnmatchedParameter = findFirstUnfilledParam(NLUIntent.parameters, customer.EntityFills)
//     if (!firstUnmatchedParameter) {
//         if (!NLUIntent.allRequiredParamsPresent) {
//             throw new Error("allRequiredParamsPresent is not true and we didnt get empty params")
//         }
//         const intent = matchIntent(customer.Intents, NLUIntent.intent.displayName)
//         return processIntent(customer, session,intent, NLUContext, eventId)

//     } else {
//         const [matchedEntityFill] = customer.EntityFills.filter((entityFill) => {
//             return entityFill.name === firstUnmatchedParameter
//         })
//         if (!matchedEntityFill) {
//             throw new Error("cant get matchedEntityFill for " + firstUnmatchedParameter)
//         }
//         if (!NLUIntent.parameters?.fields) {
//             throw new Error("cant get NLU params")
//         }
//         const responses = processResponses(customer, session, matchedEntityFill.responses,NLUContext)
//         return [responses,processSessionWithResponses(customer,session, responses, NLUContext)]
//     }
//   }
//   else if (customer.nlu === "rasa") {


//     let NLUIntent = await getIntent(customer,text,session) as RasaResponse
//     let bestIntent: Intent;
//     [bestIntent, NLUIntent] = getBestIntentNLU(customer,NLUIntent,session)
//     console.log("bestIntent",bestIntent.id,NLUIntent.intent,NLUIntent.entities)
//     if (!bestIntent) throw new Error("ts")
//     // catch ask_res not matching entity but same intent
//     if (
//       NLUIntent.intent.name.startsWith("askRes_") &&
//       session.Entities.requested_slot &&
//       session.Entities.requested_slot !== NLUIntent.intent.name.replace("askRes_","") &&
//       session.Entities.requested_slot.split("_")[0] === NLUIntent.intent.name.split("_")[1]

//     ) {
//       const detIntSlot = NLUIntent.intent.name.replace("askRes_","")
//       const detInt = detIntSlot.split("_")[1]
//       if (session.Entities[detIntSlot]) {
//         //slot exists
//         const [matchedEntityFill] = customer.EntityFills.filter((ef) => {
//           return ef.name === detInt
//         })

//         if (matchedEntityFill.overwriteSlot) {
//           if (matchedEntityFill.overwriteSlot.type !== "ask") {
//             throw new Error("only ask is handled")
//           }

//           let mappedIntentEnts: RasaSlot = {};
//           for (const entKey of Object.keys(session.Entities)) {
//             if (entKey.startsWith(bestIntent.id + "_")) {
//               mappedIntentEnts[entKey.replace(bestIntent.id + "_","")] = session.Entities[entKey]
//             }
//           }
//           console.log("NLUIntent",NLUIntent.entities)
//           const [matchedDetEnt] = NLUIntent.entities.filter((ent) => {
//             return ent.entity === detIntSlot
//           })
//           if (!matchedDetEnt) {
//             console.error("NLUIntent",NLUIntent)
//             throw new Error("different askRes but didnt come with the right detEnt")
//           }
//           session.Entities.activeIntent = "overwriteSlot_" + detIntSlot
//           session.Entities.overwriteSlotValue = matchedDetEnt.value
//           return [processResponses(
//             customer,
//             session,
//             [matchedEntityFill.overwriteSlot.response], 
//             {
//               detectedEnt: matchedDetEnt,
//               ...mappedIntentEnts
//             }

//           ), session]
//         }

//       } 
//       else throw new Error("no slot exist but wrong askRes not handled")

//     }


//     // catch no ents detected for askRes
//     if (
//       NLUIntent.intent.name.startsWith("askRes_") &&
//       NLUIntent.entities.length === 0
//     ) {
//       NLUIntent.entities.push({
//         entity: NLUIntent.intent.name.replace("askRes_",""),
//         start: 0,
//         end: 0,
//         confidence_entity: 1,
//         group: NLUIntent.intent.name.split("_")[2],
//         confidence_group: 1,
//         value: text,
//         extractor: "OpenB"
//       })
//     }
//     console.log("rasa process msg", text, session,NLUIntent.entities,bestIntent.id,NLUIntent.intent)

//     // catch affirm/deny use cases
//     if (NLUIntent.intent && isPrimitiveIntent(NLUIntent.intent.name,true)) {
//       // affirm/deny only for when topSuggest exists
//       if (session.Entities.activeIntent) {
//         // topSuggest affirm/deny
//         if (session.Entities.topSuggestSlotKey) {
//           if (NLUIntent.intent.name === "Affirm") {
//             console.log("affirm topSuggestKey", session.Entities.topSuggestSlotKey)
//             // set value to topSuggest
//             session.Entities[session.Entities.topSuggestSlotKey] = session.Entities.topSuggest
//             session.Entities.topSuggest = null
//             session.Entities.topSuggestSlotKey = null
//             session.Entities.requested_slot = null
//             session.Entities.activeIntent = null

//             // set requested_slot
//             if (!bestIntent.entities) {
//               throw new Error("no entities for topSuggest " + bestIntent.id)
//             }
//             let reqSlot = null
//             console.log("session",session)
//             for (const ent of bestIntent.entities) {
//               const entKey = ent.split("@")[0]
//               console.log("entKey",bestIntent.id + "_" + entKey)
//               if (!session.Entities[bestIntent.id + "_" + entKey]) {
//                 reqSlot = bestIntent.id + "_" + entKey
//                 break;
//               }
//             }

//           }
//           else if (NLUIntent.intent.name  === "Deny") {
//             // console.log("Deny", session,request.tracker )
//             // set value to topSuggest
//             session.Entities.topSuggest = null
//             session.Entities.topSuggestSlotKey = null
//             session.Entities.activeIntent = null
//             /// all intents are assumed to have entities because it shouldnt go into validate otherwise
//             if (!session.Entities.requested_slot.startsWith(bestIntent.id + "_")) {
//               throw new Error("deny got unexpected requested slot " + session.Entities.requested_slot)
//             }
//             const matchedEntityFill =  customer.EntityFills.find((entityFill) => entityFill.name === session?.Entities.requested_slot.replace(bestIntent.id + "_",""))
//             if (!matchedEntityFill) {
//               throw new Error("cant get matchedEntityFill for " + session.Entities.requested_slot.replace(bestIntent.id + "_",""))
//             }
//             const mappedIntentEnts: RasaSlot = {}
//             if (!bestIntent.entities) {
//               throw new Error("deny expects intent to have entities " + bestIntent.id)
//             }
//             for (const ent of bestIntent.entities) {
//               const entKey = ent.split("@")[0];
//               if (session.Entities[bestIntent.id + "_" + entKey] ) {
//                 mappedIntentEnts[entKey] = session.Entities[bestIntent.id + "_" + entKey] 
//               }

//             }
//             return [processResponses(customer, session, matchedEntityFill.responses,Object.assign({},session.Entities,mappedIntentEnts),bestIntent.id), session]
//           } 
//           else {
//             throw new Error("topSuggest invalid intent" + NLUIntent.intent.name)
//           }
//         }

//         // overwriteSlot affirm/deny
//         else if (session.Entities.activeIntent.startsWith("overwriteSlot_")) {
//           if (!session.Entities.overwriteSlotValue) throw new Error("overwriteslot value not here")
//           if (NLUIntent.intent.name === "Affirm") {
//             session.Entities[session.Entities.activeIntent.replace("overwriteSlot_","")] = session.Entities.overwriteSlotValue
//             session.Entities.overwriteSlotValue = null
//             session.Entities.activeIntent = null
//                          // validate current slots
//             const slotsToValidate: RasaDetectedEntity[] = [];
//             let mockSession = JSON.parse(JSON.stringify(session))
//             for (const entKey of Object.keys(session.Entities)) {
//               if (entKey.startsWith(bestIntent.id + "_")) {
//                 slotsToValidate.push({
//                   entity: entKey,
//                   start: 0,
//                   end: 0,
//                   confidence_entity: 1,
//                   extractor: "OpenB_Overwrite",
//                   value:  mockSession.Entities[entKey],
//                   group: entKey.replace(bestIntent.id + "_",""),
//                   confidence_group: 1
//                 })


//                 delete mockSession.Entities[entKey]

//               }
//             }
//             const [validateRes,validateSession] = validateIntentEntities(customer, mockSession, bestIntent, slotsToValidate)
//             console.log("validateRes",validateRes,validateSession)
//             if (validateRes.length !== 0) {
//               return [validateRes,validateSession]
//             }
//           }
//           else if (NLUIntent.intent.name === "Deny") {
//             session.Entities.overwriteSlotValue = null
//             session.Entities.activeIntent = null
//           } else throw new Error("overwriteSLot wrong intent " + NLUIntent.intent.name )
//         }

//       } else {
//         // no topSuggest, going to set it as best Intent now
//         NLUIntent.intent.name = bestIntent.id
//       }



//     }

//     session.lastIntent = bestIntent.id;
//     console.log("gona processIntent", bestIntent.id, NLUIntent)
//     return processIntent(customer, session, bestIntent,NLUIntent)

//   } else {
//     throw new Error("unsupported nlu " + customer.nlu)
//   }

// }
/// @dev helper function to convert RasaResponse.entities into { [key]: value }
/// @dev base function to get ${QueryItem} array out of a string

export function extractQueryItems(input: string): string[] | null {
  const regex = /\${(.+?)}/g;
  const matches = input.matchAll(regex);
  const queryItems = Array.from(matches, match => match[1]);
  return queryItems.length ? queryItems : null;
}


/// @dev base function to get extractQueryItems array from responses

export function extractQueryItemsFromResponses(responses: Response[]): string[] | null {
  let ret: string[] | null = null;
  for (const res of responses) {
    const resQuries = extractQueryItems(res.text)
    if (resQuries) {
      if (ret === null) {
        ret = [] as string[];

      }

      for (const q of resQuries) {
        if (!ret.includes(q)) {
          ret.push(q)
        }
      }
    }
  }
  return ret;
}

/// @dev helper function to check if queryItems have the right entities

export function checkEntitiesExists(queryItems: string[], obj: { [key: string]: any }): boolean {
  for (const q of queryItems) {
    if (!obj[q]) {
      if (jmespath.search(obj, q) === null) {
        return false
      }
    }
  }
  return true;
}








export function getEntityMatches(queryItems: string[], intent: Intent): string[] {
  const ret: string[] = [];
  let entities: string[] = []
  if (intent.entities) {
    entities = entities.concat(intent.entities)
  }
  if (intent.noFills) {
    entities = entities.concat(intent.noFills)
  }
  for (const queryItem of queryItems) {
    const [matchedEntityString] = entities.filter((entity) => {
      return entity.startsWith(queryItem)
    })
    if (matchedEntityString) {
      ret.push(matchedEntityString.split("@")[1])
    } else {
      throw new Error("invalid entitiy " + queryItem)
    }

  }
  return ret;
}

/// @dev getIntent wrapper for different nlu
export async function getIntent(customer: CustomerSettings, query: string, session: Session): Promise<RasaResponse | null> {
  if (customer.nlu === "es") {
    throw new Error("es depreciated")
  } else if (customer.nlu === "rasa") {
    return await rasaParseMessage(query, customer.Agent.rasaOptions)
  } else {
    throw new Error("unsupported nlu " + customer.nlu)
  }
}

/// @dev helper function to get all responses out of an intent
export function getAllResponsesFromIntent(intents: Intent[]): Response[] {
  let retRes: Response[] = []
  intents.forEach((intent) => {
    if (intent.if) {
      retRes = retRes.concat(getAllResponsesFromIntent([intent.if.booleanCondition.true, intent.if.booleanCondition.false]))
    }
    if (intent.responses) {
      retRes = retRes.concat(intent.responses)
    }
    if (intent.childIntents) {
      retRes.concat(getAllResponsesFromIntent(intent.childIntents))
    }
  })

  return retRes
}

/// @dev helper function to get state mucking config out of intents

export function getStateMods(intents: Intent[])
  : [ParamSettingsObject, ParamSettingsField, ParamSettingsField] {
  const responses = getAllResponsesFromIntent(intents)
  const maps: ParamSettingsObject = {}
  const storeArrays: ParamSettingsField = {}
  const entitiesMap: ParamSettingsField = {};
  responses.forEach((res) => {
    if (res.mapParamToObject) {
      /// not checking for dups, it might be different in diff responses
      Object.keys(res.mapParamToObject).forEach((mapKey) => {
        if (!res.mapParamToObject) throw new Error("ts")
        maps[mapKey] = res.mapParamToObject[mapKey]
      })
    }
    if (res.storeObjectInArray) {
      Object.keys(res.storeObjectInArray).forEach((aKey) => {
        if (!res.storeObjectInArray) throw new Error("ts")
        storeArrays[aKey] = res.storeObjectInArray[aKey]
      })
    }
  })

  intents.forEach((intent) => {
    if (intent.entities) {
      intent.entities.forEach((e) => {
        const key = e.split("@")[0]
        const value = e.split("@")[1]
        entitiesMap[intent.id + "_" + key] = value
      })
    }
  })
  return [maps, storeArrays, entitiesMap]
}

export /// @dev convert CustomerSettings values to lowercase as rasa converts text to lowercase
  function toLowerCaseObj(obj: any): any {
  if (typeof obj !== "object") {
    // base case: return the string value in lower case
    return typeof obj === "string" ? obj.toLowerCase() : obj;
  }

  if (Array.isArray(obj)) {
    // if obj is an array, recursively call toLowerCase on each element
    return obj.map((item) => toLowerCaseObj(item));
  }

  // if obj is an object, recursively call toLowerCase on each value
  return Object.entries(obj).reduce((acc: any, [key, value]) => {
    acc[key] = toLowerCaseObj(value);
    return acc;
  }, {});
}

/// validate detected Entity 

function isValidEntityValue(customer: CustomerSettings, slots: RasaSlot, intent: Intent, ent: RasaDetectedEntity): [boolean, boolean] {

  const [matchedEntityFill] = customer.EntityFills.filter((ef) => {
    if (ent.group) {
      return ef.name === ent.group
    }
    return ef.name === ent.entity
  })
  if (!matchedEntityFill) {
    throw new Error("cant get matchedEntityFill for " + ent.entity)
  }
  let isInMap = false;
  let hasFuzzy = false;
  const mySlots = JSON.parse(JSON.stringify(slots))
  /// translate intent_ent into ent
  Object.keys(mySlots).forEach((key) => {
    if (key.startsWith(intent.id + "_")) {
      mySlots[key.replace(intent.id + "_", "")] = mySlots[key]
    }
  })
  const combinedData = Object.assign({}, customer, getStandardObjects(customer), mySlots)
  if (matchedEntityFill.validation) {
    // validate only if mapping is defined
    for (const validation of matchedEntityFill.validation) {
      if (validation.onlyForIntents && !validation.onlyForIntents.includes(intent.id)) {
        console.log("gona skip validation for", validation)
        continue
      }

      let mappedList = getJmesPathActionData(
        renderString(validation.jmesPath, combinedData),
        combinedData
      )
      // do fuzzyset to test
      let fuzzySetRes

      if (typeof mappedList[0] === "string") {
        fuzzySetRes = FuzzySet(mappedList).get(ent.value)
        if (fuzzySetRes) {
          hasFuzzy = true;
        }
      } else {

        const mainValues = mappedList.map((ml: any) => {
          return ml.value
        })
        const mvRes = FuzzySet(mainValues).get(ent.value)
        if (mvRes && mvRes[0][0] > customer.Agent.fuzzyAutoAcceptConfidence) {
          hasFuzzy = true;
        }


        else {
          // check entire list for highest % value first
          const allRes = FuzzySet(getValuesFromEntitySynonym(mappedList)).get(ent.value)
          if (allRes && allRes[0][0] > customer.Agent.fuzzyAutoAcceptConfidence) {
            const topRes = allRes[0]
            const mainValue = getMainValueFromEntitySynonym(mappedList, topRes[1])
            if (!mainValue) {
              throw new Error("cant get main value, shouldnt happen as it was checked above")
            }
            hasFuzzy = true;
          }
        }


      }


    }
  }

  return [isInMap, hasFuzzy]
}


/// to parse webkitspeech transcripts with nlu to see which one to pick
export function getBestIntent(customer: CustomerSettings, tracker: RasaTracker, session: Session): Intent {
  let retIntent;
  let i = 0;
  if (!tracker.latest_message.intent_ranking) {
    if (isPrimitiveIntent(tracker.latest_message.intent.name)) {
      retIntent = matchIntent(customer.Intents, session.lastIntent)
    } else {
      retIntent = matchIntent(customer.Intents, tracker.latest_message.intent.name)
    }
  }
  console.log("tracker.latest_message.intent_ranking", tracker.latest_message.intent_ranking)
  while (!retIntent && i < tracker.latest_message.intent_ranking.length) {
    const detInt = tracker.latest_message.intent_ranking[i]
    console.log("bestIntent", detInt)
    if (detInt.name === "nlu_fallback") {
      ++i;
      continue;
    }
    if (detInt.name.startsWith("askRes_")) {

      if (!tracker.slots.requested_slot ||
        !detInt.name.endsWith(tracker.slots.requested_slot.split("_")[1])
      ) {

        ++i;
        continue;

      }
      retIntent = matchIntent(customer.Intents, session.lastIntent)
      retIntent.confidence = detInt.confidence
      continue;
    }
    else if (isPrimitiveIntent(detInt.name, true)) {
      // handles only Affirm + Deny here
      if (session.Entities.topSuggest) {
        console.log("session.Entities.topSuggest", session.Entities.topSuggest)
        retIntent = matchIntent(customer.Intents, session.lastIntent)
        retIntent.confidence = detInt.confidence
        continue;
      } else {
        ++i;
        continue
      }

    }
    const matchedIntent = matchIntent(customer.Intents, detInt.name);
    if (matchedIntent.required_entities) {
      let skip: boolean = false
      for (const reqSlot of matchedIntent.required_entities) {
        if (!tracker.slots[reqSlot]) {
          skip = true;
        }
      }
      if (skip) {
        ++i;
      } else {
        retIntent = matchedIntent as Intent
        retIntent.confidence = detInt.confidence
      }
    } else {
      retIntent = matchedIntent as Intent
      retIntent.confidence = detInt.confidence
    }
  }
  if (!retIntent) {
    throw new Error("cant get best intent")
  }
  return retIntent
}

export function getBestIntentNLU(customer: CustomerSettings, rasaRes: RasaResponse, session: Session): [Intent, RasaResponse] {
  let i = 0;
  let loopIntent;
  let loopDetEnt;
  console.log("getBestIntentNLU", rasaRes.intent_ranking, rasaRes.entities)
  /// skip below if topIntent is special
  let mergedEntities = mergeRepeatedEntities(rasaRes.entities)
  while (i < rasaRes.intent_ranking.length) {
    const detInt = rasaRes.intent_ranking[i]
    console.log("looping detInt", detInt, loopIntent?.id)
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
      console.log("askRes bah", detInt, session.Entities.requested_slot, session.Entities.requested_slot?.split("_")[1])
      if (!session.Entities.requested_slot ||
        !detInt.name.endsWith(session.Entities.requested_slot.split("_")[1])
      ) {
        const [matchedDetEnts] = mergedEntities.filter((me) => {
          return detInt.name.endsWith(me.entity)
        })
        if (!matchedDetEnts) {
          console.log("didnt detect matchedDetEnts")
          ++i;
          continue;
        } else if (session.lastIntent !== "Root") {
          // if detEnt has the right values, return askRes
          console.log("askRes switch")
          matchedIntent = matchIntent(customer.Intents, session.lastIntent)
          matchedIntent.confidence = detInt.confidence // with detEnts, assume its good. not sure
        } else {
          ++i;
          continue;
        }


      } else {
        console.log("setting askRes Intent", session.Entities.requested_slot)
        matchedIntent = matchIntent(customer.Intents, session.lastIntent)
        matchedIntent.confidence = detInt.confidence  // @TODO with requested slot, we can assume its good
      }

    }
    else if (isPrimitiveIntent(detInt.name, true)) {
      // handles only Affirm + Deny here
      if (session.Entities.activeIntent) {

        if (session.Entities.topSuggest) {
          console.log("session.Entities.topSuggest", session.Entities.topSuggest)
          matchedIntent = matchIntent(customer.Intents, session.lastIntent)
          matchedIntent.confidence = detInt.confidence
        }
        else if (session.Entities.activeIntent.startsWith("overwriteSlot_")) {
          const slotInt = session.Entities.activeIntent.split("_")[1]
          if (slotInt !== session.lastIntent) {
            throw new Error("invalid overwriteslot Int")
          }
          matchedIntent = matchIntent(customer.Intents, session.lastIntent)
          matchedIntent.confidence = detInt.confidence
        } else {
          ++i;
          continue
        }


      } else {
        console.log("gona skip", detInt)
        ++i;
        continue
      }

    } else {
      matchedIntent = matchIntent(customer.Intents, detInt.name)
      matchedIntent.confidence = detInt.confidence
    }

    // handled req ents
    if (matchedIntent.required_entities) {
      let skip: boolean = false
      for (const reqSlot of matchedIntent.required_entities) {
        if (!session.Entities[reqSlot]) {
          skip = true;
        }
      }
      if (skip) {
        ++i;
      }
    }
    /// deal with det Ents
    const intentEntKeys = matchedIntent.entities?.map((ent) => {
      return ent.split("@")[0]
    }) || []

    const numEnts = mergedEntities.length
    for (const detEnt of mergedEntities) {
      if (detEnt.group && detEnt.confidence_group) {
        if (detEnt.entity.startsWith(matchedIntent.id + "_") && intentEntKeys.includes(detEnt.group)) {
          matchedIntent.confidence += ((detEnt.confidence_entity + detEnt.confidence_group) / (2)) / numEnts
        } else {
          // detected wrong ent, ding it
          matchedIntent.confidence -= 1 / numEnts
        }
      } else {
        if (intentEntKeys.includes(detEnt.entity)) {
          matchedIntent.confidence += detEnt.confidence_entity / numEnts
        } else {
          // detected wrong ent, ding it
          matchedIntent.confidence -= 1 / numEnts !== 0 ? numEnts : 1
        }
      }
    }
    console.log("end loopIntent", loopIntent?.id, loopDetEnt)
    if (loopIntent === undefined) {
      loopIntent = matchedIntent
      loopDetEnt = detInt
    }
    else if
      (
      loopIntent.confidence &&
      loopIntent.confidence < matchedIntent.confidence
    ) {
      loopIntent = matchedIntent
      loopDetEnt = detInt
    }
    ++i;
  }

  if (!loopIntent) throw new Error("ts")
  if (!loopDetEnt) throw new Error("ts")
  console.log("loopIntent", loopIntent.id, loopDetEnt)
  rasaRes.intent = loopDetEnt
  return [loopIntent, rasaRes]
}

export async function calculateScore(customer: CustomerSettings, slots: RasaSlot, transcript: Transcript): Promise<number> {
  const parseRes = await rasaParseMessage(transcript.text, customer.Agent.rasaOptions);
  let score = parseRes.intent.confidence;

  if (!isPrimitiveIntent(parseRes.intent.name)) {
    const matchedIntent = matchIntent(customer.Intents, parseRes.intent.name);
    if (matchedIntent.entities && matchedIntent.entities.length !== 0) {
      let entScore = 0;
      for (const ent of parseRes.entities) {
        if (ent.entity.startsWith(matchedIntent.id + "_") && ent.confidence_group) {
          const validEnt = isValidEntityValue(customer, slots, matchedIntent, ent);

          if (validEnt[0]) {
            entScore += ((ent.confidence_entity + ent.confidence_group) / 2);
          }
          if (validEnt[1]) {
            entScore += ((ent.confidence_entity + ent.confidence_group) / 2);
          }
        } else {
          console.error("invalid ent, ding it?", ent);
          throw new Error("invalid ent");
        }

      }
      score += (entScore / matchedIntent.entities.length);

    } else {
      // add 1 to score always? we are using slots not det ents here??
      // score += 1;
    }
  }

  return score;
}

export async function getBestTranscript(customer: CustomerSettings, slots: RasaSlot, transcripts: Transcript[]): Promise<Transcript> {
  let highestScore = 0;
  let bestTs;
  // for (const transcript of transcripts) {

  //   const score = await calculateScore(customer, slots, transcript);
  //   console.log("getBestTranscript",transcript,score)
  //   if (highestScore < score) {
  //     highestScore = score;
  //     bestTs = transcript;
  //     console.log("bestTs", highestScore, bestTs);
  //   }
  // }
  for (const transcript of transcripts) {
    let score = -1;
    if (transcript.confidence) {
      score = transcript.confidence
    } else {
      score = 1
    }
    if (highestScore < score) {
      highestScore = score;
      bestTs = transcript;
    }
  }
  if (!bestTs) {
    throw new Error("didnt get bestTs");
  }

  return bestTs;
}

export function sleep(ms: number) {
  new Promise(resolve => setTimeout(resolve, ms))
}

