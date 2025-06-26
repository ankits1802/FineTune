'use server';

/**
 * @fileOverview Generates music ideas based on user-provided text input.
 *
 * - getMusicIdeasFromText - A function that generates music ideas based on text input.
 * - GetMusicIdeasFromTextInput - The input type for the getMusicIdeasFromText function.
 * - GetMusicIdeasFromTextOutput - The return type for the getMusicIdeasFromText function.
 */

import { createHash } from 'crypto';
import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GetMusicIdeasFromTextInputSchema = z.object({
  inputText: z
    .string()
    .describe('The text input provided by the user to generate the music seed.'),
});
export type GetMusicIdeasFromTextInput = z.infer<typeof GetMusicIdeasFromTextInputSchema>;

const GetMusicIdeasFromTextOutputSchema = z.object({
  tempo: z.number().describe('The suggested tempo in BPM, between 60 and 180.'),
  key: z.string().describe('The suggested musical key, e.g., "C Major", "A minor".'),
  style: z.string().describe('A descriptive musical style, e.g., "upbeat pop", "somber piano ballad".'),
  hashValue: z
    .string()
    .describe('The hash value generated from the input text.'),
});
export type GetMusicIdeasFromTextOutput = z.infer<typeof GetMusicIdeasFromTextOutputSchema>;


export async function getMusicIdeasFromText(
  input: GetMusicIdeasFromTextInput
): Promise<GetMusicIdeasFromTextOutput> {
  return getMusicIdeasFromTextFlow(input);
}

const PromptOutputSchema = z.object({
    tempo: z.number().describe('The suggested tempo in BPM, between 60 and 180.'),
    key: z.string().describe('The suggested musical key, e.g., "C Major", "A minor".'),
    style: z.string().describe('A descriptive musical style, e.g., "upbeat pop", "somber piano ballad".'),
  });

const getMusicIdeasFromTextPrompt = ai.definePrompt({
  name: 'getMusicIdeasFromTextPrompt',
  input: {schema: GetMusicIdeasFromTextInputSchema},
  output: {schema: PromptOutputSchema},
  prompt: `You are a creative musical assistant. Analyze the mood, themes, and rhythm of the following text and translate it into musical characteristics.

Provide a tempo in beats per minute (BPM) between 60 and 180.
Suggest a musical key (e.g., C Major, F# minor).
Describe a musical style in a few words (e.g., "energetic electronic", "gentle acoustic folk", "cinematic orchestral").

Text Input: {{{inputText}}}

Based on the text, generate the musical characteristics.`,
});

const getMusicIdeasFromTextFlow = ai.defineFlow(
  {
    name: 'getMusicIdeasFromTextFlow',
    inputSchema: GetMusicIdeasFromTextInputSchema,
    outputSchema: GetMusicIdeasFromTextOutputSchema,
  },
  async (input) => {
    const maxRetries = 3;
    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      try {
        const { output } = await getMusicIdeasFromTextPrompt(input);
        if (!output) {
          throw new Error("Failed to generate music ideas: No output received.");
        }
        
        const hash = createHash('sha256');
        hash.update(input.inputText);
        const hashValue = hash.digest('hex');

        return {
          ...output,
          hashValue,
        };
      } catch (error) {
        lastError = error;
        attempt++;
        if (attempt < maxRetries) {
          // Wait for a short period before retrying (exponential backoff)
          await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt - 1)));
        }
      }
    }

    // If all retries fail, throw the last captured error.
    console.error("All retries failed for getMusicIdeasFromTextFlow.", lastError);
    throw new Error(`Failed to generate music ideas after ${maxRetries} attempts. The service may be temporarily unavailable.`);
  }
);
