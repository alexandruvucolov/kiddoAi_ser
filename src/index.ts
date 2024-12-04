import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { AIAgent } from './agents/types';
import { createAgent } from './agents/createAgent';
import { apiKey, serverClient } from './serverClient';

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

// Map to store the AI Agent instances
// [cid: string]: AI Agent
const aiAgentCache = new Map<string, AIAgent>();
const pendingAiAgents = new Set<string>();

app.get('/', (req, res) => {
  res.json({ message: 'Server is running', apiKey: apiKey });
});

/**
 * Handle the request to start the AI Agent
 */
app.post('/start-ai-agent', async (req, res) => {
  const {
    channel_id,
    channel_type = 'messaging',
    platform = 'anthropic',
  } = req.body;

  // Simple validation
  if (!channel_id) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  let channel_id_updated = channel_id;
  if (channel_id.includes(':')) {
    const parts = channel_id.split(':');
    if (parts.length > 1) {
      channel_id_updated = parts[1];
    }
  }

  const user_id = `ai-bot-${channel_id_updated.replace(/!/g, '')}`;
  try {
    if (!aiAgentCache.has(user_id) && !pendingAiAgents.has(user_id)) {
      pendingAiAgents.add(user_id);

      await serverClient.upsertUser({
        id: user_id,
        name: 'AI Bot',
        role: 'admin',
      });
      const channel = serverClient.channel(channel_type, channel_id_updated);
      try {
        await channel.addMembers([user_id]);
      } catch (error) {
        console.error('Failed to add members to channel', error);
      }

      await channel.watch();

      const agent = await createAgent(
        user_id,
        platform,
        channel_type,
        channel_id_updated,
      );

      await agent.init();
      if (aiAgentCache.has(user_id)) {
        await agent.dispose();
      } else {
        aiAgentCache.set(user_id, agent);
      }
    } else {
      console.log(`AI Agent ${user_id} already started`);
    }

    res.json({ message: 'AI Agent started', data: [] });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('Failed to start AI Agent', errorMessage);
    res
      .status(500)
      .json({ error: 'Failed to start AI Agent', reason: errorMessage });
  } finally {
    pendingAiAgents.delete(user_id);
  }
});

/**
 * Handle the request to stop the AI Agent
 */
app.post('/stop-ai-agent', async (req, res) => {
  const { channel_id, channel_type = 'messaging' } = req.body;
  try {
    const userId = `ai-bot-${channel_id.replace(/!/g, '')}`;
    if (aiAgentCache.has(userId)) {
      const aiAgent = aiAgentCache.get(userId);
      await aiAgent!.dispose();

      const channel = serverClient.channel(channel_type, channel_id);
      await channel.removeMembers([userId]);

      aiAgentCache.delete(userId);
    }
    res.json({ message: 'AI Agent stopped', data: [] });
  } catch (error) {
    const errorMessage = (error as Error).message;
    console.error('Failed to stop AI Agent', errorMessage);
    res
      .status(500)
      .json({ error: 'Failed to stop AI Agent', reason: errorMessage });
  }
});

// Start the Express server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
