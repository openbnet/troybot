import { CustomerSettings } from "./types";
import { Telegraf } from 'telegraf';

export async function sendMessageTelegram(customer: CustomerSettings, message: string): Promise<void> {

  const bot = new Telegraf(customer.orderChannel.token);

  try {
    await bot.telegram.sendMessage(customer.orderChannel.chatId, message);
  } catch (error) {
    throw new Error(`Failed to send message: ${error}`);
  }

}

