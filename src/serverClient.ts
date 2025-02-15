import { StreamChat } from 'stream-chat';

require('dotenv').config();

export const apiKey = process.env.STREAM_API_KEY as string;
export const apiSecret = process.env.STREAM_API_SECRET as string;

// export const apiKey = "5svvkruencpb";
// export const apiSecret = "q5nvjxd46dpnk8rp7eu45ehqag8qurfyfeja6umjfst9vmtjn8jzj9y95f3z2mag";

if (!apiKey || !apiSecret) {
  throw new Error(
    'Missing required environment variables STREAM_API_KEY or STREAM_API_SECRET',
  );
}

export const serverClient = new StreamChat(apiKey, apiSecret);
