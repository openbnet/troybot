import fs from 'fs';
import { CustomerSettings, Intent, RasaRule } from "./types"
import YAML from 'js-yaml';
import _ from "lodash";
import { toLowerCaseObj, extractQueryItems, getEntityMatches, getStateMods, isSubset, isValidIntent, getAllResponsesFromIntent, shouldResetContexts, isPrimitiveIntent, isNoContextSwitchIntent } from './Utils';
import { RasaOptions,rasaParseMessage, rasaPredict, RasaPredictInput, RasaResponse } from './rasa';
import { getValueFromEntityFill, isValidFillCase } from './EntityFillUtils';
import { getStandardObjects, getCombinations, getStandardObjectValues, getRasaDomainLookup } from './BaseDataTransformUtils';

function omitDeep(json: any, keys: string[]): any {
  return _.cloneDeepWith(json, (value) => {
    if (_.isArray(value)) {
      return _.map(value, (val) => omitDeep(val, keys));
    } else if (_.isObject(value)) {
      return _.omit(_.mapValues(value, (val) => omitDeep(val, keys)), keys);
    }
    return value;
  });
}

function hasAnyKeys(obj: any, keys: string[]): boolean {
    const flatObj = _.flattenDeep(_.values(obj));
    return keys.some((key) => flatObj.includes(key));
  }
  
const helloIntent = {
    intent: 'hello',
    examples: [
    'hey',
    'hello',
    'hi',
    'hello there',
    'good morning',
    'good evening',
    'moin',
    'hey there',
    "let's go",
    'hey dude',
    'goodmorning',
    'goodevening',
    'good afternoon',
    ],
}

function getAllEntitiesFromIntents(intents: Intent[]): string[] {
  const ret: string[] = []
  intents.forEach((intent) => {
    if (intent.entities) {
      for (const ent of intent.entities) {
        if (!ret.includes(ent)) {
          ret.push(ent)
        }
      }
    }
  })
  return ret
}
function intentsToNluYaml(intents: Intent[], customer: CustomerSettings): string {
    const nluObject = { nlu: [] } as any;
    for (const intent of intents) {
        if (!intent.utterances) {
            console.error("intent",intent)
            throw new Error("no utterances for intent " + intent.id)
        }
        if (intent.utterances.length < 2) {
            throw new Error("need at least two utterances " + intent.id)
        }
        const nluItem = {
          intent: intent.id,
          examples: buildIntentUtterances(customer,intent).map((e) => `- ${e}`).join('\n')
        };
        

        nluObject.nlu.push(nluItem);

    }
    return YAML.dump(nluObject,
        {
            lineWidth: -1,
            noRefs: true,
          },
        ).replace(/\|-/g, "|");
}


const polite_postfixes = [
  "[please](Polite)",
  "[pretty please](Polite)",
  "[thank you](Polite)",
  "[thank you very much](Polite)",
  "[thanks](Polite)",
  "[much appriciated](Polite)",
]
let polite_index = 0;
function getPolite(toRandom: boolean): [null, string | null] {
  //poilite always return postfix
  // 30% of people are polite
  if (toRandom) {
    if (Math.random() < 0.3) {
      return [null,null]
    }
  } 
  const tmp = polite_postfixes[polite_index]
  if ((polite_index + 1) === polite_postfixes.length) {
    polite_index = 0;
  } else {
    ++polite_index;
  }
  return [null,tmp]

}

const askRes_prefixes = [
  "give me",
  "[please](Polite) give me",
  "change it to",
  "[please](Polite) change it to",
  "i want",
  "i think",
  "actually i want",
  "sorry give me",
  "sorry i want"
]
let askRes_index = 0;
function getAskResPeFix(toRandom: boolean): [string | null,null] {
  // 50% of people prefix
  if (Math.random() < 0.5) {
    return [null,null]
  }
  const tmp = askRes_prefixes[askRes_index]
  if ((askRes_index + 1) === askRes_prefixes.length) {
    askRes_index = 0;
  } else {
    ++askRes_index;
  }
  return [tmp,null]
  
}

function getAskModifiers(toRandom: boolean): [string | null, string | null] {
  const [,polite] = getPolite(toRandom)
  const [askRes] = getAskResPeFix(toRandom)
  return [askRes,polite]
}

function writeIntentEntityAsks(writePath: string , intents: Intent[], customer: CustomerSettings) {
  const nluObject = { nlu: [] } as any;
  const rulesObj = { rules: [] } as any;
  const standardObj = getStandardObjects(customer)

  // intent specific ents
  // for (const intent of intents) {
  //     const intentUttNum = intent.utterances ? intent.utterances.length : 0
  //     for (const ent of intent.entities || []) {
  //       const entKey = ent.split("@")[0]
  //       const tableKey = ent.split("@")[1]
  //       if (!standardObj[tableKey]) {
  //         throw new Error("cant get " + tableKey)
  //       }
  //       const values = standardObj[tableKey]
  //       if (!values[0]) {
  //         throw new Error("values not array ")
  //       }
  //       if (intentUttNum > 20) {
  //         if (typeof values[0] === "string") {
  //           const annotatedValues = values.map((v) => {
  //             const [askResPrefix,polite] = getAskModifiers(true)
              
  //             if (polite) {
  //               if (askResPrefix) {
  //                 return `${askResPrefix} (${v}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${polite}`
  //               } else {
  //                 return `(${v}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${polite}`
  //               }
                
  //             }
  //             if (askResPrefix) {
  //               return `${askResPrefix} (${v}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" }`
  //             } else {
  //               return `(${v}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" }`
  //             }
              
              
  //           })
  //           const nluItem = {
  //             intent: "askRes_" + intent.id + "_" + entKey,
  //             examples: annotatedValues
  //           };
  //           nluObject.nlu.push(nluItem)
  //         } else {
  //           if (!values[0].value) {
  //             throw new Error("has to be string of value,synonyms!")
  //           }
  //           let examples: string[] = []
  //           for (const v of values) {
  //             const [mainAskResPrefix,mainPolite] = getAskModifiers(true)
  //             if (mainPolite) {
  //               if (mainAskResPrefix) {
  //                 examples.push(`${mainAskResPrefix} (${v.value}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${mainPolite}`)
  //               } else {
  //                 examples.push(`(${v.value}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${mainPolite}`)
  //               }
                
  //             } else {
  //               examples.push(`(${v.value}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" }`)
  //             }
  //             for (const syn of v.synonyms) {
  //               const [synAskResPrefix,synPolite] = getAskModifiers(true)
  //               if (synPolite) {
  //                 if (synAskResPrefix) {
  //                   examples.push(`${synAskResPrefix} (${syn}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${synPolite}`)
  //                 } else {
  //                   examples.push(`(${syn}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${synPolite}`)
  //                 }
                  
  //               } else {
  //                 if (synAskResPrefix) {
  //                   examples.push(`${synAskResPrefix} (${syn}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" }`)
  //                 } else {
  //                   examples.push(`(${syn}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" }`)
  //                 }
                  
  //               }
  //             }
  //           }
  
  //           // remove '' 
  
  //           const nluItem = {
  //             intent: "askRes_" + intent.id + "_" + entKey,
  //             examples
  //           };
  //           nluObject.nlu.push(nluItem)
  
  //         }
  //       } else {
  //         // just repeat prefix and postfix for all?
  //         if (typeof values[0] === "string") {
  //           const annotatedValues = values.map((v) => {
  //             const [askResPrefix,polite] = getAskModifiers(false)
              
  //             if (polite) {
  //               if (askResPrefix) {
  //                 return `${askResPrefix} (${v}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${polite}`
  //               } else {
  //                 return `(${v}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${polite}`
  //               }
                
  //             } else throw new Error("not supposed to should have all asks")
  //           })
  //           annotatedValues.push(
  //             ...values.map((v) => { 
  //               return `(${v}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" }`
  //             })
  //           )
  //           const nluItem = {
  //             intent: "askRes_" + intent.id + "_" + entKey,
  //             examples: annotatedValues
  //           };
  //           nluObject.nlu.push(nluItem)
  //         } else {
  //           if (!values[0].value) {
  //             throw new Error("has to be string of value,synonyms!")
  //           }
  //           let examples: string[] = []
  //           for (const v of values) {
  //             const [mainAskResPrefix,mainPolite] = getAskModifiers(false)
  //             if (mainPolite) {
  //               if (mainAskResPrefix) {
  //                 examples.push(`${mainAskResPrefix} (${v.value}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${mainPolite}`)
  //               } else {
  //                 examples.push(`(${v.value}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${mainPolite}`)
  //               }
  //               examples.push(`(${v.value}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" }`)
                
  //             } else {
  //               throw new Error("examples not supposed to happen")
  //             }
  //             for (const syn of v.synonyms) {
  //               const [synAskResPrefix,synPolite] = getAskModifiers(false)
  //               if (synPolite) {
  //                 if (synAskResPrefix) {
  //                   examples.push(`${synAskResPrefix} (${syn}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${synPolite}`)
  //                 } else {
  //                   examples.push(`(${syn}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" } ${synPolite}`)
  //                 }
  //                 examples.push(`(${syn}){ "entity": "${intent.id}_${entKey}", "group": "${entKey}" }`)
  //               } 
  //             }
  //           }
  
  //           // remove '' 
  
  //           const nluItem = {
  //             intent: "askRes_" + intent.id + "_" + entKey,
  //             examples
  //           };
  //           nluObject.nlu.push(nluItem)
  
  //         }
  //       }



  //       // handle rules
  //       const intentRule = {
  //         rule: "askRes_" + intent.id + "_" + entKey,
  //         condition: [
  //           { active_loop: "form_" + intent.id, },
  //           {
  //             slot_was_set: [
  //               {requested_slot: intent.id + "_" + entKey}
  //             ]
  //           }
  //         ],
  //         steps: [
  //           { 
  //             intent: "askRes_" + intent.id + "_" + entKey,
  //           },
  //           { 
  //             action: "form_" + intent.id,
  //           },
  //         ],
  //       }
  //       rulesObj.rules.push(intentRule)
  //     }


  // }
  
  // non intent specific ents

  for (const entFill of customer.EntityFills) {
      const values = standardObj[entFill.mappedTo]
      if (!values[0]) {
        throw new Error("values not array ")
      }
      // just repeat prefix and postfix for all?
      if (typeof values[0] === "string") {
        const annotatedValues = values.map((v) => {
          const [askResPrefix,polite] = getAskModifiers(false)
          
          if (polite) {
            if (askResPrefix) {
              return `${askResPrefix} [${v}](${entFill.name}) ${polite}`
            } else {
              return `[${v}](${entFill.name}) ${polite}`
            }
            
          } else throw new Error("not supposed to should have all asks")
        })
        annotatedValues.push(
          ...values.map((v) => { 
            return `[${v}](${entFill.name})`
          })
        )
        const nluItem = {
          intent: "askRes_" + entFill.name,
          examples: annotatedValues
        };
        nluObject.nlu.push(nluItem)
      } else {
        if (!values[0].value) {
          throw new Error("has to be string of value,synonyms!")
        }
        let examples: string[] = []
        for (const v of values) {
          const [mainAskResPrefix,mainPolite] = getAskModifiers(false)
          if (mainPolite) {
            if (mainAskResPrefix) {
              examples.push(`${mainAskResPrefix} [${v.value}](${entFill.name}) ${mainPolite}`)
            } else {
              examples.push(`[${v.value}](${entFill.name}) ${mainPolite}`)
            }
            examples.push(`[${v.value}](${entFill.name})`)
            
          } else {
            throw new Error("examples not supposed to happen")
          }
          for (const syn of v.synonyms) {
            const [synAskResPrefix,synPolite] = getAskModifiers(false)
            if (synPolite) {
              if (synAskResPrefix) {
                examples.push(`${synAskResPrefix} [${syn}](${entFill.name}) ${synPolite}`)
              } else {
                examples.push(`[${syn}](${entFill.name}) ${synPolite}`)
              }
              examples.push(`[${syn}](${entFill.name})`)
            } 
          }
        }

          const nluItem = {
            intent: "askRes_"  + entFill.name,
            examples
          };
          nluObject.nlu.push(nluItem)
      }
  }
  fs.writeFileSync(`${writePath}/data/askRes.yml`,
    YAML.dump(nluObject,
      {
          lineWidth: -1,
          noRefs: true,
        },
      ).replace(/examples:/g,"examples: |").replace(/'/g,"")
  )
  fs.appendFileSync(`${writePath}/data/askRes.yml`,
  YAML.dump(rulesObj,
    {
        lineWidth: -1,
        noRefs: true,
      },
    )
)
}
function buildIntentUtterances(settings: CustomerSettings, intent: Intent): string[]   {
  if (!intent.utterances) {
      throw new Error("intent has no utterace");
  }
  let utt: string[] = [];
  const StaticData = getStandardObjects(settings);
  for (let i=0; i < intent.utterances.length; i++) {

      const utterance = intent.utterances[i];
      if (!utterance) {
        throw new Error("cant get utterance " + intent.id)
      }
      const queryItems = extractQueryItems(utterance)
      if (!queryItems) {
          utt.push(utterance)
          continue;
      }
      console.log("queryItems",queryItems)
      let entityNames: string[] = [];
      if (!isValidIntent) throw new Error("invalid intent")
      entityNames = getEntityMatches(queryItems, intent)
        
      console.log("entityNames",entityNames,intent.id)
      if (!isSubset(entityNames, Object.keys(StaticData))) {
          console.error("entityNames not subset of StaticData", entityNames, Object.keys(StaticData))
          throw new Error("entityNames not subset of StaticData")
      }

      // @TODO gota refactor somewhere, hack for now
      const forcedSettings = JSON.parse(JSON.stringify(settings))
      forcedSettings.nlu = "es";
      const esStaticData = getStandardObjects(forcedSettings);
      
      const combinations = getCombinations(entityNames, queryItems, esStaticData);
      // handle nomatch
      for (const combination of combinations) {
          const uttInstance = utterance
          // handle the data injects sequantially in order
          utt.push(formatUtteranceString(uttInstance,combination,intent))
      }
  }
  return utt;
}

function intentsToNluDomain(settings: CustomerSettings, intents: Intent[]): string {
    let actions = intents
      .filter((i) => !isPrimitiveIntent(i.id))
      .map((i) => "action_intent_" + i.id)


    for (const intent of intents) {
      for (const ent of intent.entities || []) {
        actions.push("action_ask_" + intent.id + "_" + ent.split("@")[0])
      }
      
    }
    actions.push("action_leavingContext")
    actions.push("action_joiningContext")
    actions.push("action_default_fallback")
    // const intentsWithEntities

    // handle entities & slots
    const intentIds = intents.map((i) => i.id)
    const forms: any = {}
    const slots = {} as any;
    const newEntities: string[] = []
    const entities: any[] = []
    for (const intent of intents) {
      if (intent.entities) {
        for (const newEntity of intent.entities) {
          const key = newEntity.split("@")[0];
          const table = newEntity.split("@")[1];
          if (!newEntities.includes(key)) {
            newEntities.push(key)
            entities.push({
              [key]: {
                type: "lookup",
                table,
                influence_conversation: true
              }
            })
          } 

          // handle slots

          const [entityFill] = settings.EntityFills.filter((ef) => {
            return ef.name === key
          })
          if (!entityFill) {
            throw new Error("cant get entityFill")
          }
          let mappings = [] as any;
          switch (entityFill.type) {
            case "text":
              mappings.push({
                type: "from_entity",
                // intent: intent.id,
                entity: key
              })
              break;
            case "float":
                mappings.push({
                  type: "from_entity",
                  // intent: intent.id,
                  entity: key
                })
                break;
            default:
              throw new Error("type not handled " + entityFill.type)
          }
          slots[intent.id + "_" + key] = {
            type: entityFill.type,
            influence_conversation: true,
            mappings
          }
        }
        forms["form_" + intent.id] = {
          required_slots: intent.entities.map((e) => intent.id + "_" + e.split("@")[0])
        }
        actions.push("validate_form_" + intent.id)
      }
      if (intent.noFills) {
        for (const newEntity of intent.noFills) {
          const key = newEntity.split("@")[0];
          const table = newEntity.split("@")[1];
          if (!newEntities.includes(key)) {
            newEntities.push(key)
            entities.push({
              [key]: {
                type: "lookup",
                table,
                influence_conversation: true
              }
            })
          } 
        }
      }
    }


    // askRes intents
    for (const entityFill of settings.EntityFills) {
      intentIds.push("askRes_" + entityFill.name)
    }

    slots.topSuggest = {
      type: "text",
      influence_conversation: false,
      mappings: [
        { type: "custom"}
      ]
    }
    slots.topSuggestSlotKey = {
      type: "text",
      influence_conversation: true,
      mappings: [
        { type: "custom"}
      ]
    }

    slots.interruptedIntents = {
      type: "list",
      influence_conversation: false,
      mappings: [{
        type: "custom"
      }]
    }
    const interruptableIntents = settings.Intents.filter((i) => {
      return i.entities
    }).map((i) => {
      return i.id
    })
    slots.interruptedIntent = {
      type: "categorical",
      influence_conversation: true,
      values: interruptableIntents,
      mappings: [{
        type: "custom"
      }]
    }
    const allIntentEnts: string[] = [];
    for (const i of settings.Intents) {
      if (i.entities) {
        for (const ent of i.entities) {
          allIntentEnts.push(i.id + "_" + ent.split("@")[0])
        }
      }
    }
    console.log("allIntentEnts",allIntentEnts)
    slots.requested_slot = {
      type: "categorical",
      influence_conversation: true,
      values: [...allIntentEnts],
      mappings: [{
        type: "custom"
      }]
    }

    slots.activeIntent = {
      type: "categorical",
      influence_conversation: true,
      values: [...allIntentEnts],
      mappings: [
        { type: "custom"}
      ]
    }
    // handle slots for mapParamToObject & storeObjectInArray
    const [maps, arrays] = getStateMods(intents)

    Object.keys(maps).forEach((key) => {
      slots[key] = {
        type: "any",
        influence_conversation: false, // cannot be set true for any
        mappings: [
          { 
            type: "custom"
          }
        ]
      }
    })
    

    Object.keys(arrays).forEach((key) => {
      slots[key] = {
        type: "list",
        influence_conversation: true, // cannot be set true for any
        mappings: [
          { 
            type: "custom"
          }
        ]
      }
    })


    return YAML.dump({
        intents: intentIds,
        session_config: {
            session_expiration_time: 60,
            carry_over_slots_to_new_session: false
        },
        actions,
        lookup_tables: getRasaDomainLookup(settings),
        slots,
        entities,
        forms,
        responses: {
          utter_default: [{
            text: "I'm sorry , i dont understand. can you repharse your request?"
          }]
        }
    })
}


function generatePermutations(items: any[]): any[][] {
  const n = items.length;
  const permutations: any[][] = [];

  for (let i = 0; i < 2 ** n; i++) {
    const binaryString = i.toString(2).padStart(n, "0");
    const permutation: any[] = [];

    for (let j = 0; j < n; j++) {
      if (binaryString.charAt(j) === "1") {
        permutation.push(items[j]);
      }
    }

    permutations.push(permutation);
  }

  return permutations;
}
function intentsToStories(settings: CustomerSettings,intents: Intent[]): string {
    return YAML.dump(getStories(settings,intents))
}

function getStories(settings: CustomerSettings,intents: Intent[]): {stories: any[]} {
  const storiesObj = { stories: [] as any };
  for (const intent of intents) {
      if (isPrimitiveIntent(intent.id)) {
        continue
      }
      if (!isValidIntent(intent)) {
          throw new Error("invalid intent")
      }
      // if (intent.entities && intent.required_entities) {
      //   console.error("intent",intent)
      //   throw new Error("dont support required_entities with intent.entities yet!")
      // }
      if (!intent.entities || intent.entities.length === 0) {
        // this is a basic use case where there are no required entities in this intent

        const intentStory = {
          story: intent.id + " with no entites defined",
          steps: []
        } as any;
        if (intent.required_entities) {
          intentStory.steps.push({
            slot_was_set: intent.required_entities.map((e) => {
              return {
              [e]: [getStandardObjectValues(settings,e, 1)[0]]
              }
            })

          })
        }
        console.log("intentStory",JSON.stringify(intentStory.steps,null,4))
        intentStory.steps.push({ intent: intent.id })
        const responses = getAllResponsesFromIntent([intent])
        const resetValue = shouldResetContexts(responses)
        if (resetValue === true) {
          intentStory.steps.push({ action: "action_intent_" + intent.id})
          intentStory.steps.push({action: "action_restart"})
        } else if (resetValue === "mine") {
          if (!intent.entities) {
            throw new Error("resetContexts mine requires entities to be setup")
          }
          intentStory.steps.push({ action: "action_intent_" + intent.id})
          intentStory.steps.push({
            slot_was_set: intent.entities.map((e) => {
              return { [e.split("@")[0]]: false}
            })
          })
        } else if (resetValue === "rewind") {
          intentStory.steps.push({ action: "action_intent_" + intent.id})
        }
        
        else if (!resetValue) {
          intentStory.steps.push({ action: "action_intent_" + intent.id})
        } 
        intentStory.steps.push({ action: "action_listen" })
        storiesObj.stories.push(intentStory)
      


        
      } else {
        const required = intent.entities.map((i) => i.split("@")[0])
        const lookupObjNames = intent.entities.map((i) => i.split("@")[1])
        const entityFillingPermutations = generatePermutations(required)

        // @TODO ugly hack here to merge all responses. will break advanced use cases
        const responses = getAllResponsesFromIntent([intent])
        const resetValue = shouldResetContexts(responses)


        // handle case of nothing is filled
        const noEntityStory = {
          story: intent.id + " No entity match",
          steps: [] as any
        }
        if (intent.required_entities) {
          noEntityStory.steps.push( { slot_was_set: intent.required_entities.map((e) => {
            return {
            [e]: getStandardObjectValues(settings,e, 1)[0]
            }
          })} )
        }
        noEntityStory.steps.push({ intent: intent.id })
        
        for (const [i, key] of required.entries()) {
          noEntityStory.steps.push({
            action: "form_" + intent.id 
          })
          noEntityStory.steps.push({
            active_loop: "form_" + intent.id 
          })

          noEntityStory.steps.push({
            slot_was_set: [{
              requested_slot: intent.id + "_" + key
            }]
          })
          // noEntityStory.steps.push({
          //   action: "action_ask_" + key
          // })
    
          noEntityStory.steps.push({
            intent: "askRes_" + intent.id + "_"+ key,
            entities: [
              { [intent.id + "_" + key] : getValueFromEntityFill(settings,key,1, intent.id)[0]}
            ]
          })
          noEntityStory.steps.push({
            action: "form_" + intent.id
          })

          noEntityStory.steps.push({
            slot_was_set: [{
              [intent.id + "_" + key]: getStandardObjectValues(settings,lookupObjNames[i], 1)[0]
            }]
          })


        }
        
        noEntityStory.steps.push({
          slot_was_set: [{
            requested_slot: null
          }]
        })
        noEntityStory.steps.push({
          active_loop: null
        })
        noEntityStory.steps.push(
          { action: "action_intent_" + intent.id}
        )
        if (resetValue === true) {
          noEntityStory.steps.push({action: "action_restart"})
        } else if (resetValue === "mine") {
          if (!intent.entities) {
            throw new Error("resetContexts mine requires entities to be setup")
          }
          noEntityStory.steps.push({
            slot_was_set: intent.entities.map((e) => {
              return { [intent.id + "_" + e.split("@")[0]]: null}
            })
          })
        }
        noEntityStory.steps.push({ action: "action_listen" })
        storiesObj.stories.push(noEntityStory)
    
        // deal with entityFillingPermutations
        
        for (const fillCase of entityFillingPermutations) {
          if (fillCase.length === 0) continue;
          if (!isValidFillCase(settings,fillCase)) continue;
          const entitiesWeNeed = required.filter((r) => {
            return !fillCase.includes(r)
          })
          
          const intentStory = {
            story: intent.id + " with entities " + JSON.stringify(fillCase),
            steps: []
          } as any
          if (intent.required_entities) {
            intentStory.steps.push( { slot_was_set: intent.required_entities.map((e) => {
              return {
              [e]: getStandardObjectValues(settings,e, 1)[0]
              }
            })} )
          }
          intentStory.steps.push({ intent: intent.id,
            entities: fillCase.map((fillCaseKey) => {
              if (!intent.entities) {
                throw new Error("ts needs another one")
              }
              const [matchedLookUpTable] = getEntityMatches([fillCaseKey], intent)
              if (!matchedLookUpTable) {
                throw new Error("cant get lookuptable for " + fillCaseKey)
              }
              return {
                 [intent.id + "_" + fillCaseKey]: getStandardObjectValues(settings,matchedLookUpTable, 1)[0]
              }
            })
          
          })
          intentStory.steps.push({
            action: "form_" + intent.id 
          })
          intentStory.steps.push({
            active_loop: "form_" + intent.id 
          })
          fillCase.forEach((caseKey) => {
            if (!intent.entities) {
              throw new Error("ts needs another one")
            }
            const [matchedLookUpTable] = getEntityMatches([caseKey], intent)
            if (!matchedLookUpTable) {
              throw new Error("cant get lookuptable for " + caseKey)
            }
            intentStory.steps.push({
              slot_was_set: [{
                [intent.id + "_" + caseKey]: getStandardObjectValues(settings,matchedLookUpTable, 1)[0]
             }]
            })
          })
          for (const [i, key] of entitiesWeNeed.entries()) {
           
            intentStory.steps.push({
              slot_was_set: [{
                requested_slot: intent.id + "_" + key
              }]
            })
            // intentStory.steps.push({
            //   action: "action_ask_" + key
            // })
            intentStory.steps.push({
              intent: "askRes_" + intent.id + "_" + key,
              entities: [
                { [intent.id + "_" + key] : getValueFromEntityFill(settings,key,1, intent.id)[0]}
              ]
            })
            intentStory.steps.push({
              action: "form_" + intent.id
            })
            intentStory.steps.push({
              slot_was_set: [{
                [intent.id + "_" + key]: getValueFromEntityFill(settings,key,1, intent.id)[0]
              }]
            })
          }

          intentStory.steps.push({
            slot_was_set: [{
              requested_slot: null
            }]

          })

          intentStory.steps.push({
            active_loop: null
          })
          // end intent
          intentStory.steps.push(
            { action: "action_intent_" + intent.id}
          )
          if (resetValue === true) {
            intentStory.steps.push({action: "action_restart"})
          } else if (resetValue === "mine") {
            if (!intent.entities) {
              throw new Error("resetContexts mine requires entities to be setup")
            }
            for (const ent of intent.entities) {
              intentStory.steps.push({
                slot_was_set: [{
                  [intent.id + "_" + ent.split("@")[0]]: null
                }]
              })
            }
          }
          intentStory.steps.push({ action: "action_listen" })
          storiesObj.stories.push(intentStory)
        }

      }

      
      // const hasChildren = hasAnyKeys(intent,["childIntents"])
      // if (hasChildren) {
      //     console.log("intent has children", intent)
      //     throw new Error("handle this")
      // } else {
      //     const intentStory = {
      //         story: intent.id,
      //         steps: [
      //             { intent: intent.id },
      //             { action: "action_" + intent.id}
      //         ]
      //     }
      //     storiesObj.stories.push(intentStory)
      // }
  }
  return storiesObj
}

// function intentsToTests(settings: CustomerSettings,intents: Intent[]): string {
//   const stories = getStories(settings,intents)
//   console.log("stories",stories)
// }

function intentsToRules(settings: CustomerSettings,intents: Intent[]): string {
  const initialRules = getRules(settings,intents)
  return YAML.dump(initialRules)
}
function getContextSwitchingRules(intents: Intent[], rules: RasaRule[]): RasaRule[] {
  const retRules: RasaRule[] = [];
  for (const intent of intents) {
    const notMeRules = rules.filter((r) => {
      const ruleIntentId = r.rule.split(" ")[0]
      return !isPrimitiveIntent(ruleIntentId) && ruleIntentId !== intent.id && !isNoContextSwitchIntent(ruleIntentId)
    })
    if (intent.entities) {
      // wont be need to context switch if it has no entities as there is no slot filling
      console.log("notMeRules",notMeRules)
      for (const rule of notMeRules) {
        if (!rule.condition || rule.rule.endsWith(" start")) {
          const contextSwitchRule = {
            rule: intent.id + " switching into " + rule.rule,
            condition: [
              { active_loop: "form_" + intent.id }
            ],
            steps: [] as any,
            wait_for_user_input: false
          }
          contextSwitchRule.steps.push(...rule.steps)

          // inject leaving context after intent
          if (!contextSwitchRule.steps[0].intent) {
            console.error("contextSwitchRule",contextSwitchRule)
            throw new Error("expect first step to always be intent")
          }
          if (contextSwitchRule.steps[contextSwitchRule.steps.length - 1].action && 
            contextSwitchRule.steps[contextSwitchRule.steps.length - 1].action === "action_listen"
          ) {
            contextSwitchRule.steps.pop()
          }
          console.log("contextSwitchRule",contextSwitchRule)
          contextSwitchRule.steps.splice(1,0,{
            action: "action_leavingContext"
          })
          contextSwitchRule.steps.splice(2,0,{
            slot_was_set: [
              {interruptedIntents : [intent.id] }
            ]
          })
          console.log("after splice contextSwitchRule",contextSwitchRule)
          contextSwitchRule.steps.splice(3,0,{
            slot_was_set: [
              {interruptedIntent : intent.id }
            ]
          })
          console.log("after splice2 contextSwitchRule",contextSwitchRule)


          if (!rule.condition) {
            contextSwitchRule.steps.push({
              action: "action_joiningContext"
            })
            contextSwitchRule.steps.push({
              slot_was_set: [
                {interruptedIntents : null }
              ]
            })
            contextSwitchRule.steps.push({
              slot_was_set: [
                {interruptedIntent : null }
              ]
            })
            contextSwitchRule.steps.push({
              action: "form_" + intent.id
            })
            contextSwitchRule.steps.push({
              active_loop: "form_" + intent.id
            })
          }



          retRules.push(contextSwitchRule)
        } else {
          if (rule.rule.endsWith(" execute")) {
            console.log("rule execute", JSON.stringify(rule,null,4))
            const executeRuleSwitch = JSON.parse(JSON.stringify(rule))
            executeRuleSwitch.rule += " switching back into " + intent.id
            if (
              executeRuleSwitch.condition[1].slot_was_set[executeRuleSwitch.condition[1].slot_was_set.length - 2]
              .interruptedIntents !== false
            ) { throw new Error("execute should have interrupted intents false as 2nd last condition slot")}
            executeRuleSwitch.condition[1].slot_was_set.pop()
            executeRuleSwitch.condition[1].slot_was_set.pop()

            executeRuleSwitch.condition[1].slot_was_set.push({
              interruptedIntents: [intent.id]
            })
            executeRuleSwitch.condition[1].slot_was_set.push({
              interruptedIntent: intent.id
            })

            if (executeRuleSwitch.steps[executeRuleSwitch.steps.length - 1].action && executeRuleSwitch.steps[executeRuleSwitch.steps.length - 1].action == "action_listen") {
              executeRuleSwitch.steps.pop()
            }
            
            executeRuleSwitch.steps.push({
              action: "action_joiningContext"
            })
            executeRuleSwitch.steps.push({
              slot_was_set: [
                {interruptedIntents : null }
              ]
            })
            executeRuleSwitch.steps.push({
              slot_was_set: [
                {interruptedIntent : null }
              ]
            })
            executeRuleSwitch.steps.push({
              action: "form_" + intent.id
            })
            executeRuleSwitch.steps.push({
              active_loop: "form_" + intent.id
            })
            executeRuleSwitch.wait_for_user_input = false
            retRules.push(executeRuleSwitch)
          }
          
        }
      }

    }
  }
  return retRules
}
function getRules(settings: CustomerSettings,intents: Intent[]): { rules: RasaRule[]} {
  const rulesObj = { rules: [] as RasaRule[]};
  for (const intent of intents) {
      if (isPrimitiveIntent(intent.id)) {
        // primitiveActions have no action_intent, they are meant to be used in the context of another active loop, ie. forms
        if (intent.required_entities) {
          console.log("intent.required_entities",intent.required_entities)
          const slot_was_set = intent.required_entities.map((e) => {
            return {
              [e]: true
            }
          })
          slot_was_set.push({
            activeIntent: true
          })
          const intentRule = {
            rule: intent.id + " isPrimitiveIntent rule with required_entities",
            condition: [{
              slot_was_set
            }],
            steps: [
                { 
                  intent: intent.id,
                },
            ]
          }
          rulesObj.rules.push(intentRule)
        }

        continue
      }
      if (!isValidIntent(intent)) {
          throw new Error("invalid intent")
      }
      
      if (!intent.entities || intent.entities.length === 0) {
        // this is a basic use case where there are no required entities in this intent

        const intentRule = {
          rule: intent.id + " with no entites defined",
        } as any;
        if (intent.required_entities) {
          const slot_was_set = intent.required_entities.map((e) => {
            return {
              [e]: true
            }
          })
          slot_was_set.push({
            requested_slot: false
          })
          slot_was_set.push({
            activeIntent: false
          })
          intentRule.condition = [{
            slot_was_set
          }]
        }
        intentRule.steps = [
          { intent: intent.id },
        ]
        const responses = getAllResponsesFromIntent([intent])
        const resetValue = shouldResetContexts(responses)
        if (resetValue === true) {
          intentRule.steps.push({ action: "action_intent_" + intent.id})
          intentRule.steps.push({action: "action_restart"})
        } else if (resetValue === "mine") {
          if (!intent.entities) {
            throw new Error("resetContexts mine requires entities to be setup")
          }
          intentRule.steps.push({ action: "action_intent_" + intent.id})
          intentRule.steps.push({
            slot_was_set: intent.entities.map((e) => {
              return { [e.split("@")[0]]: false}
            })
          })
        } else if (resetValue === "rewind") {
          intentRule.steps.push({ action: "action_intent_" + intent.id})
        }
        else if (!resetValue) {
          intentRule.steps.push({ action: "action_intent_" + intent.id})
          
        }
        intentRule.steps.push({ action: "action_listen" })
        rulesObj.rules.push(intentRule)
    
      } else {
        const required = intent.entities.map((i) => i.split("@")[0])
        // const lookupObjNames = intent.entities.map((i) => i.split("@")[1])
        // const entityFillingPermutations = generatePermutations(required)
        // handle case of nothing is filled
        const allDomainEntities = getAllEntitiesFromIntents(settings.Intents)
        const responses = getAllResponsesFromIntent([intent])
        const resetValue = shouldResetContexts(responses)
        let slot_was_set: any[] = [];
        if (intent.required_entities) {
          slot_was_set = intent.required_entities.map((e) => {
            return {
              [e]: true
            }
          })

        } 
        slot_was_set.push({
          requested_slot: false
        })
        slot_was_set.push({
          interruptedIntents: false
        })
        slot_was_set.push({
          interruptedIntent: false
        })
        const startIntentRule = {
          rule: intent.id + " start",
          condition: [
            { active_loop: null },
            { slot_was_set }
          ] as any,
          steps: [
              { intent: intent.id },
              { action: "form_" + intent.id },
              { active_loop: "form_" + intent.id},
          ] as any,
          wait_for_user_input: false
        }
        // add unused etities DONT DO THIS, let it be free
        // const unusedEntities = allDomainEntities.filter((ent) => {
        //   return !intent.entities?.includes(ent)
        // }).map((i) => i.split("@")[0])

        // unusedEntities.forEach((ent) => {
        //   if (!startIntentRule.condition[1].slot_was_set) {
        //     throw new Error("ts not smart enough")
        //   }
        //   startIntentRule.condition[1].slot_was_set.push({ [ent] : false})
        // })


        console.log("startIntentRule",startIntentRule)

        // dont seem to need to define anything within forms loop
        rulesObj.rules.push(startIntentRule)
        // // deal with each entity's ask
        // const newDeps: string[] = [];
        // for (const req of required) {
        //   const reqRule = {
        //     rule: intent.id + " ask_" + req,
        //     condition: [
        //       { active_loop: "form_" + intent.id },
        //       { slot_was_set: [
        //         { [req] : false } 
        //       ]},
        //     ],
        //     steps: [
        //         // { action: "action_ask_" + req},
        //         { active_loop: "form_" + intent.id},
        //         { slot_was_set: [{
        //           requested_slot: req
        //         }]},
        //         // { action: "validate_form_" + intent.id }
        //     ] as any
        //   }
        //   for (const newDep of newDeps) {
        //     reqRule.condition[1].slot_was_set?.push(
        //       { [newDep]: true }
        //     )
        //   }
        //   newDeps.push(req)
        //   rulesObj.rules.push(reqRule)
        // }
        // deal with intent actual action after slot filling
        const executeSlots: {[key: string]: any }[] = required.map((r) => {
          return {
            [intent.id + "_" + r]: true
          }
        })
        // console.log("executeSlots", executeSlots)
        executeSlots.push({
          requested_slot: false
        })

        if (intent.required_entities) {
          // only supports global and slots now, cant hit intent.id_ents
          intent.required_entities.forEach((e) => {
            executeSlots.unshift({
              [e]: true
            })
          })

        } 
        executeSlots.push({
          interruptedIntents: false
        })
        executeSlots.push({
          interruptedIntent: false
        })
        const executeIntentRule = {
          rule: intent.id + " execute",
          condition: [
            { active_loop: "form_" + intent.id },
            { 
              slot_was_set: executeSlots
            }
          ],
          steps: [
              // { action: "validate_form_" + intent.id },
              { active_loop: null },
              { action: "action_intent_" + intent.id },
          ] as any
        }

        if (resetValue === true) {
          executeIntentRule.steps.push({action: "action_restart"})
        } else if (resetValue === "mine") {
          if (!intent.entities) {
            throw new Error("resetContexts mine requires entities to be setup")
          }
          executeIntentRule.steps.push({
            slot_was_set: intent.entities.map((e) => {
              return { [intent.id + "_" + e.split("@")[0]]: null}
            })
          })
        }
        // // all use cases including false needs this
        executeIntentRule.steps.push({action: "action_listen"})

        rulesObj.rules.push(executeIntentRule)




        // handle action_ask_Ent rules

        // for (const requ of required) {
        //   const reqRule = {
        //     rule: intent.id + " form ask flow " + requ,
        //     condition: [
        //       {
        //         active_loop: "form_" + intent.id
        //       },
        //       {
        //         slot_was_set: [
        //           { requested_slot: intent.id + "_" + requ}
        //         ]
        //       }
        //     ],
        //     steps: [
        //       {action: "action_ask_" + requ}
        //     ]
        //   }
        //   rulesObj.rules.push(reqRule)
        // }
      }


 
  }
  return rulesObj
}
function formatUtteranceString(utterance: string, entityValues: {[entityName: string]: string}, intent: Intent): string {
  const entityRegex = /\${(\w+)}/g;
  const intEnts = intent.entities ? intent.entities.map((ent) => {
    return ent.split("@")[0]
  }) : []
  const noFillEnts = intent.noFills ? intent.noFills.map((ent) => {
    return ent.split("@")[0]
  }) : []
  return utterance.replace(entityRegex, (_, entityName) => {
    const entityValue = entityValues[entityName];
    if (intEnts.includes(entityName)) {
      return entityValue ? `[${entityValue}](${entityName})` : '';
    } 
    else if (noFillEnts.includes(entityName)) {
      return entityValue ? `[${entityValue}](${entityName})` : '';
    }
    else throw new Error("unmatched ent " + entityName)
  });

}
function filterIntents(intents: Intent[], id: string): Intent[] {
  return intents.filter((i) => {
    return i.id === id
  })
}
export function generateRasaConfig(rasaRoot:string, customer: CustomerSettings) {
  // const allRules = getRules(customer, customer.Intents)
  fs.mkdirSync(`${rasaRoot}/data/`, { recursive: true })
  for (const intent of customer.Intents) {
    const filteredIntents = filterIntents(customer.Intents, intent.id)
    // throw new Error(`writing to ${rasaRoot}/data/${intent.id}.yml`)
    console.log(`writing to ${rasaRoot}/data/${intent.id}.yml`)
    
    fs.writeFileSync(`${rasaRoot}/data/${intent.id}.yml`,intentsToNluYaml(filteredIntents, customer))
    // const rulesObj = getRules(Customer,filteredIntents)
    // const contextSwitches = getContextSwitchingRules(filteredIntents,allRules.rules)
    // rulesObj.rules.push(...contextSwitches)
    // fs.appendFileSync(`./rasa/data/${intent.id}.yml`,YAML.dump(rulesObj))
    
    // console.log("contextSwitches",contextSwitches)
    // fs.appendFileSync(`./rasa/data/${intent.id}.yml`,intentsToStories(Customer,filteredIntents))
    
  }
  

  fs.writeFileSync(`${rasaRoot}/domain.yml`,intentsToNluDomain(customer, customer.Intents))
  writeIntentEntityAsks(rasaRoot, customer.Intents,customer)
}
