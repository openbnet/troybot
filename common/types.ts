import { google } from "@google-cloud/dialogflow/build/protos/protos";
import { RasaOptions } from "./rasa";


export type SalesItem = {
  id: string;
  display_name: string;
  tts_name?: string;
  synonyms: [];
  description: string;
  class: string;
  sizes: Size[];
  options?: SalesItemOptions[][];
  ingredients?: string[];
  disclaimers?: string[];
  min_order_amount?: number;
  preparation_minutes?: number;
};
export type Size = {
  name: string;
  synonyms: string[];
  addPrice: number;
};
export type SalesItemOptions = {
  option_type: string;
  allowAdd: boolean;
  addPrice: number;
  allowSub: boolean;
  subPrice: number;
  disclaimers: string[];
  preparation_minutes: number;
};

export type SalesItemOrderItem = {
  OrderItem: string;
  Quantity: number;
  Size: string;
};
export type Order = {
  id: number;
  customer_id: number;
  items: SalesItemOrderItem[];
  pickuptime: Date;
};

export type Channel = {
  name: "telegram";
  chatId: string;
  token: string;
};
export type SupportLanguage = "en" | "en-au" | "en-sg";
export type TimeZone = "Asia/Singapore";

export type FeaturedPerson = {
  image: string;
  text: string;
};
export type AboutUs = {
  featuredPeople: FeaturedPerson[];
  text: string;
};
export type CustomerSettings = {
  version: string;
  id: string;
  nlu: "es" | "rasa" | "rasaAction";
  defaultResponse: Response;
  orderChannel: Channel;
  Store?: StoreSettings;
  Tables?: TableSettings[];
  SalesItems: SalesItem[]
  Intents: Intent[];
  EntityFills: EntityFill[];
  Agent: {
    supportedLanguages: SupportLanguage[]; //first item will be default language
    defaultTimezone: TimeZone;
    stackDriverLogs: boolean;
    interactionLogs: boolean;
    mlMinimumConfidence: number;
    fuzzyAutoAcceptConfidence: number;
    rasaOptions: RasaOptions; // req if = rasa
    actionServer: RasaOptions; // used for client to hit server
    logMongo?: {
      url: string;
    };
  };
};

export type EntityFillMapping = {
  jmesPath: string;
  noSuggestRes: string; // jmesPathString
  suggestRes: string; // jmesPathString
  onlyForIntents?: string[];
};
export type EntityFill = {
  name: string;
  mappedTo: string;
  type: "text" | "bool" | "categorical" | "float" | "list" | "any";
  required: string[];
  overwriteSlot?: {
    type: "ask";
    response: Response;
  };
  responses: Response[];
  validation?: EntityFillMapping[]; // jmespath , used for handling form validation.
  // expect array that validate would do an includes of input value
};

export type DFBackupIntentContext = {
  name: string;
  lifespan: number;
  parameters?: google.protobuf.IStruct;
};

export type ParamSettingsField = {
  [fieldKey: string]: string;
};
export type ParamSettingsObject = {
  [objectKey: string]: ParamSettingsField;
};
export type ParamRemoveByKey = {
  [objectKey: string]: {
    key: string;
    value: string;
  };
};
export type resetContextsType = boolean | "mine" | undefined | "rewind";
export type Response = {
  text: string;
  affectedContexts?: OutputContext[];
  action?: "JmesPathAction" | "JsonLogicAction";
  prefixActionOutputArray?: string; // only for JmesPathAction that outputs arrays
  resetContexts?: resetContextsType; // only applies to last response in array. mine will reset only your entities in slots
  actionResponse?: string;
  actionConfig?: Record<string, unknown>; // arb JSON object
  actionInputs?: MatchObjectsObject[];
  mapParamToObject?: ParamSettingsObject;
  removeObjectInArray?: ParamRemoveByKey;
  setSlots?: RasaSlot;
  storeObjectInArray?: {
    [arrayKey: string]: string;
  };
  custom?: Session; // used for rasaAction nlu type
  onlyForIntents?: string[]; // to allow for choosing response based on intent
};

export type MatchObjectsObject = {};
export type intentIf = {
  booleanCondition: {
    condition: Record<string, any>;
    true: Intent;
    false: Intent;
  };
};

export type Intent = {
  id: string;
  utterances?: string[];
  entities?: string[]; // this is for user input captured entites
  required_entities?: string[]; // this is for rasa rule conditions. only works for global entities and slots. intent local ents not supported yet
  noFills?: string[]; // we use this to not set the entity in rasa, but just to use our templating system to spit out permutations to the nlu
  inputContexts?: string[];
  // oneOf below
  if?: intentIf;
  responses?: Response[];
  // endOneof
  childIntents?: Intent[];
  confidence?: number; // used only to append values to it during processing, dont use for config
};

export type IntentRasa = {
  name: string;
  confidence: number;
};

export type TableSettings = {
  id: number;
  seating: number;
  petsAllowed: boolean;
};
export type StoreSettings = {
  Alchohol: AlchoholSettings;
  disclaimers: string[];
};

export type AlchoholSettings = {
  hasLicense: boolean;
  Corkage: CorkageSettings;
};

export type CorkageSettings = {
  price: number;
};

export interface IDialogflowEntityJSON {
  id: string;
  name: string;
  required: boolean;
  dataType: string;
  value: string;
  defaultValue: string;
  isList: boolean;
  prompts: any[];
  promptMessages: any[];
  noMatchPromptMessages: any[];
  noInputPromptMessages: any[];
  outputDialogContexts: any[];
}
export interface IDialogflowEventJSON {
  name: string;
}

export interface IDialogflowIntentJSON {
  id: string;
  name: string;
  auto: boolean;
  contexts: string[];
  responses: IDialogflowIntentResponseJSON[];
  priority: number;
  webhookUsed: boolean;
  webhookForSlotFilling: boolean;
  fallbackIntent: boolean;
  events: IDialogflowEventJSON[];
  conditionalResponses: any[];
  condition: string;
  conditionalFollowupEvents: any[];
}
export interface IDialogflowIntentResponseJSON {
  resetContexts: boolean;
  action: string;
  parameters: {
    id: string;
    name: string;
    required: boolean;
    dataType: string;
    value: string;
    defaultValue: string;
    isList: boolean;
    prompts: any[];
    promptMessages: any[];
    noMatchPromptMessages: any[];
    noInputPromptMessages: any[];
    outputDialogContexts: any[];
  }[];
  messages: any[];
  speech: any[];
}

export interface IDialogflowEntityJSON {
  id: string;
  name: string;
  required: boolean;
  dataType: string;
  value: string;
  defaultValue: string;
  isList: boolean;
  prompts: any[];
  promptMessages: any[];
  noMatchPromptMessages: any[];
  noInputPromptMessages: any[];
  outputDialogContexts: any[];
}

export interface IDialogflowAgentJSON {
  description: string;
  shortDescription: string;
  language: string;
  supportedLanguages: string[];

  examples: string;
  linkToDocs: string;
  displayName: string;
  disableInteractionLogs: boolean;
  disableStackdriverLogs: boolean;
  defaultTimezone: string;
  webhook?: {
    url: string;
    username: string;
    headers: object;
    available: true;
    useForDomains: false;
    cloudFunctionsEnabled: false;
    cloudFunctionsInitialized: false;
  };
  isPrivate: boolean;
  mlMinConfidence: number;

  enableOnePlatformApi: boolean;
  onePlatformApiVersion: string;
  secondaryKey: string;
  analyzeQueryTextSentiment: boolean;
  enabledKnowledgeBaseNames: string[];
  knowledgeServiceConfidenceAdjustment: number;
  dialogBuilderMode: boolean;
  baseActionPackagesUrl: string;
}

export type UtteranceData = {
  text: string;
  userDefined: boolean;
};
export interface IDialogFlowIntentUtteranceJSON {
  id: string;
  data: UtteranceData[];
  isTemplate: boolean;
  count: number;
  lang: SupportLanguage;
  updated: number;
}

export interface IDialogflowEntity {
  id: string;
  name: string;
  isOverridable: boolean;
  isEnum: boolean;
  isRegexp: boolean;
  automatedExpansion: boolean;
  allowFuzzyExtraction: boolean;

  // entries: { value: string; synonyms: string[] }[]; dont do this first, dont know what its for
}

export type Session = {
  _id: string;
  Entities: RasaSlot; // store session data
  lastIntent: string;
  affectedContexts: OutputContext[];
  tracker: TrackerEvent[];
};

export type TrackerEvent = {
  _id: string;
  intent: string;
  action: string;
};

export type UserSession = {
  _id: string;
  tracker: UserTrackerEvent[];
  ended?: boolean;
};
export type UserTrackerEvent = {
  _id: string;
  text: string;
  intent: string;
  action: string;
  date: Date;
  detectedEnts: RasaDetectedEntity[];
};
export type OutputContext = {
  name: string;
  lifespanCount: number;
  parameters?: google.protobuf.IStruct;
};
export type EntityInstance = {
  value: string;
  synonyms: string[];
};

export type RasaSlot = {
  [key: string]: any;
};
export type RasaDetectedEntity = {
  entity: string;
  start: number;
  end: number;
  confidence_entity: number;
  extractor: string;
  value: any;
  group?: string;
  confidence_group?: number;
};
export type RasaLatestMessage = {
  text: string;
  intent: IntentRasa;
  entities: RasaDetectedEntity[];
  intent_ranking: {
    name: string;
    confidence: number;
  }[];
  events: RasaEvent[];
};
export type RasaTracker = {
  latest_message: RasaLatestMessage;
  sender_id: string;
  slots: RasaSlot;
  events: RasaEvent[];
};
export type RasaRequest = {
  next_action: string;
  sender_id: string;
  tracker: RasaTracker;
};

export type RasaEvent = {
  event:
  | "action"
  | "session_started"
  | "user"
  | "slot"
  | "action_execution_rejected"
  | "active_loop"
  | "followup"
  | "rewind"
  | "undo";
  timestamp?: number;
  name?: string | null;
  confidence?: number;
  policy?: string;
  action_text?: string;
  hide_rule_turn?: boolean;
  value?: any;
  slot?: string;
  intent?: {
    name: string;
    confidence: number;
  };
  entities?: any[];
  text?: string;
  parse_data?: any;
  metadata?: any;
  input_channel?: string;
  message_id?: string;
  data?: any;
};

export type RasaRule = {
  rule: string;
  condition?: any;
  steps: any[];
};

//   base types??

export type EntitySynonymType =
  | string
  | {
    value: string;
    synonyms: string[];
  };

export type Transcript = {
  text: string;
  confidence: number;
};

export type NLURequest = {
  text?: string;
  session?: Session;
};
export type NLUResponse = {
  responses: Response[];
  session: Session;
  voice: string;
};
