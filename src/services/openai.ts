export const KNOWN_PARTIES = ['BJP', 'INC', 'UPA', 'NDA', 'AAP', 'SP', 'BSP', 'TMC'] as const;
export type KnownParty = (typeof KNOWN_PARTIES)[number];

export type PartyDetectionResult =
  | { party: KnownParty; person: string; confidence: 'high' | 'low' }
  | { party: null; reason: string };

const VISION_SYSTEM_PROMPT = `You are an expert on Indian politics and political cartoons.
Given an editorial cartoon image, identify the main Indian politician or political figure depicted.
Respond with JSON only, no markdown, in one of these two shapes:
{"person":"<full name>","confidence":"high"|"low"}
{"person":null,"reason":"<why you cannot identify anyone>"}`;

const PARTY_SEARCH_PROMPT = (person: string) =>
  `Which Indian political party does ${person} currently belong to as of 2026? ` +
  `Choose exactly one from this list: BJP, INC, UPA, NDA, AAP, SP, BSP, TMC. ` +
  `NDA and UPA are alliances — use them only if the person represents the alliance as a whole, not a member party. ` +
  `Reply with a single JSON object: {"party":"<name>","reason":"<one sentence>"}`;

async function identifyPersonFromImage(
  apiKey: string,
  imageUrl: string,
): Promise<{ person: string; confidence: 'high' | 'low' } | { person: null; reason: string }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
            { type: 'text', text: 'Who is the main politician in this cartoon?' },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenAI vision error: ${response.status} ${await response.text()}`);
  const data: any = await response.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';

  try {
    const parsed = JSON.parse(content);
    if (parsed.person) {
      return { person: parsed.person, confidence: parsed.confidence === 'low' ? 'low' : 'high' };
    }
    return { person: null, reason: parsed.reason ?? 'Could not identify person' };
  } catch {
    return { person: null, reason: `Could not parse response: ${content}` };
  }
}

async function lookupPartyViaWebSearch(
  apiKey: string,
  person: string,
): Promise<KnownParty | null> {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: PARTY_SEARCH_PROMPT(person),
    }),
  });

  if (!response.ok) throw new Error(`OpenAI search error: ${response.status} ${await response.text()}`);
  const data: any = await response.json();

  // Responses API returns output as an array of content blocks
  const textBlock = data.output?.find((b: any) => b.type === 'message')
    ?.content?.find((c: any) => c.type === 'output_text');
  const text: string = textBlock?.text ?? '';

  // Extract JSON from the response (model may wrap it in prose)
  const match = text.match(/\{[^}]+\}/);
  if (!match) {
    console.warn('Web search party lookup: no JSON in response:', text);
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]);
    const party = parsed.party as string;
    if (KNOWN_PARTIES.includes(party as KnownParty)) {
      console.log(`Web search party for "${person}": ${party} — ${parsed.reason}`);
      return party as KnownParty;
    }
    return null;
  } catch {
    return null;
  }
}

export async function detectPartyFromImage(
  apiKey: string,
  imageUrl: string,
): Promise<PartyDetectionResult> {
  // Step 1: identify the person from the cartoon
  const identification = await identifyPersonFromImage(apiKey, imageUrl);
  if (!identification.person) {
    return { party: null, reason: 'reason' in identification ? identification.reason : 'Could not identify person' };
  }

  const { person, confidence } = identification;
  console.log(`Identified politician: "${person}" (confidence: ${confidence})`);

  // Step 2: look up their current party via web search
  const party = await lookupPartyViaWebSearch(apiKey, person);
  if (!party) {
    return { party: null, reason: `Could not determine party for "${person}" via web search` };
  }

  return { party, person, confidence };
}
