interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

interface DiscordMessagePayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

export async function sendDiscordMessage(channelId: string, payload: DiscordMessagePayload) {
  try {
    // Call the Bot service directly via Docker internal network
    const response = await fetch(`http://bot:8080/notify/war-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          channelId,
          embeds: payload.embeds
      }),
    });

    if (!response.ok) {
      // Try to read error body
      const text = await response.text();
      console.error(`Failed to send notification to Bot service (${response.status}):`, text);
    }
  } catch (error) {
    console.error('Error communicating with Bot service:', error);
  }
}