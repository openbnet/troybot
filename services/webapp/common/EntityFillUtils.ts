import { google } from "@google-cloud/dialogflow/build/protos/protos";
import { getStandardObjects, getStandardObjectValues, getValuesFromEntitySynonym } from "./BaseDataTransformUtils";
import { CustomerSettings, EntityFill } from "./types";
import { decodeValue, getJmesPathActionData, isSubset, renderString } from "./Utils";


/// @dev used in rasa config generation
export function getValueFromEntityFill(settings: CustomerSettings, key: string,numValue: 1,intentId: string): any[] {
    settings = Object.assign(settings, getStandardObjects(settings))
    const [matchedIntent] = settings.Intents.filter((i) => {
        return i.id === intentId
    })
    if (!matchedIntent) {
        throw new Error("cant get intent for " + intentId)
    }
    const [matchedEntityFill] = settings.EntityFills.filter((entityFill) => {
        return entityFill.name === key
    })
    if (!matchedEntityFill) {
        throw new Error("cant getValueFromEntityFill for " + key)
    }
    if (!matchedEntityFill.validation) {
        throw new Error("getValueFromEntityFill requires validation for " + key)
    }

    const matchedValidations = matchedEntityFill.validation.filter((v) => {
        if (v.onlyForIntents) {
            if (v.onlyForIntents.includes(intentId)) {
                return true
            }
        } else {
            return true
        }
    })

    if (matchedValidations.length !== 1) {
        console.error("matchedValidations",matchedValidations)
        console.error("intentId",intentId,key)
        throw new Error("has more then 1 matchedValidations " + key)
    }
    const matchedValidation = matchedValidations[0]

    // append new inputs into object
    for (const req of matchedEntityFill.required) {
        if (!matchedIntent.entities) {
            throw new Error("matchedIntent.entities doesnt exist " + intentId)
        }
        const matchedObjKey = matchedIntent.entities.filter((e) => {
            return e.startsWith(req)
        })[0].split("@")[1]
        if (!matchedObjKey) {
            throw new Error("cant get matchedObjKey " + req)
        }
        (settings as any)[req] = getStandardObjectValues(settings,matchedObjKey, numValue)[0]
    }
    const mappedList = getJmesPathActionData(
        renderString(matchedValidation.jmesPath,settings),
        settings
    )
    return getValuesFromEntitySynonym(mappedList.slice(0, numValue))
}

export function findFirstUnfilledParam(params: google.protobuf.IStruct, entityFills: EntityFill[]): string | undefined {
    const filled: string[] = [];
    const unfilled: string[] = [];
    if (!params.fields) {
      throw new Error("param no fields");
    }
    for (const key of Object.keys(params.fields)) {
      const value = params.fields[key];
      if (!value) {
        throw new Error("cant get value" + key);
      }
      const decodedValue = decodeValue(value);
      if (!decodedValue) {
        unfilled.push(key);
      } else {
        filled.push(key);
      }
    }
    for (const unfill of unfilled) {
      const matchedEntity = entityFills.find((entityFill) => entityFill.name === unfill);
      if (!matchedEntity) {
        throw new Error(`Can't find entity fill for "${unfill}"`);
      }
      if (isSubset(matchedEntity.required, filled)) {
        return unfill;
      }
    }
    return undefined;
}

export function isValidFillCase(settings: CustomerSettings, fillCase: string[]): boolean {
    for (const c of fillCase) {
        const [matchedEntityFill] = settings.EntityFills.filter((e) => {
            return e.name === c
        })
        if (!matchedEntityFill) {
            throw new Error("no entityFill for " + c)
        }
        if (matchedEntityFill.required) {
            for (const r of matchedEntityFill.required) {
                if (!fillCase.includes(r)) {
                    return false
                }
            }
        }
    }
    return true
}