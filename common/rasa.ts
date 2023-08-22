import { analyticsreporting_v4 } from "googleapis";
import { NumberListInstance } from "twilio/lib/rest/pricing/v2/number";
import { Session, Response } from "./types";

export type RasaEntitiy = {
  entity: string;
  start: number;
  end: number;
  confidence_entity: number,
  value: string,
  group?: string,
  confidence_group?: number,
  extractor: string

}

export type RasaNameConfidence = {
  name: string;
  confidence: number;
}
export type RasaResponse = {
  entities: RasaEntitiy[];
  intent: RasaNameConfidence;
  text: string;
  intent_ranking: RasaNameConfidence[];
}

interface RasaRequestBody {
  text: string;
}

export interface RasaPredictRequestBody extends RasaRequestBody {
  sender: string;
}

export interface RasaOptions {
  url: string;
  token: string;
}
export interface RasaPredictInput {
  event: string;
  // timestamp: null;
  // metadata: {
  //     [key: string]: string | number;
  // };
  text: string;
  // input_channel: string;
  // message_id: string;
  parse_data: RasaResponse;
}
export async function rasaParseMessage(message: string, options: RasaOptions): Promise<RasaResponse> {
  const url = `${options.url}/model/parse`;
  // not using message_id, no real use to control it? our current id is session id
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify({ text: message }),
  }).then((res) => res.json())
    .catch((err) => {
      console.error("RasaParseMessage err", err);
      throw new Error(err)
    });

}

export async function rasaPredict(input: RasaPredictInput[], options: RasaOptions): Promise<RasaResponse> {
  const url = `${options.url}/model/predict`;

  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify(input),
  }).then((res) => res.json())
    .catch((err) => {
      console.error("RasaPredict err", err);
      throw new Error(err)
    });
}

export async function rasaAddMessage(session: Session, message: string, options: RasaOptions): Promise<any> {
  const url = `${options.url}/conversations/${session._id}/messages?include_events=APPLIED`
  // not using message_id, no real use to control it? our current id is session id
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify({
      text: message,
      sender: "user"
    }),
  }).then((res) => res.json())
    .catch((err) => {
      console.error("rasaAddMessage err", err);
      throw new Error(err)
    });

}

export async function rasaPreductNextAction(conversationId: string, options: RasaOptions): Promise<any> {
  const url = `${options.url}/conversations/${conversationId}/predict`
  // not using message_id, no real use to control it? our current id is session id
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${options.token}`,
    }
  }).then((res) => res.json())
    .catch((err) => {
      console.error("rasaAddMessage err", err);
      throw new Error(err)
    });

}

export async function rasaUserMessage(session: Session, query: string, options: RasaOptions): Promise<Response[]> {
  const url = `${options.url}/webhooks/rest/webhook`
  // not using message_id, no real use to control it? our current id is session id
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify({
      sender: session._id,
      message: query
    }),
  }).then((res) => res.json())
    .then((res) => {
      console.log("rasaUserMessage res from rasa", JSON.stringify(res, null, 4))
      return res
    })
    .catch((err) => {
      console.error("rasaUserMessage err", err, url);
      throw new Error(err)
    });

}