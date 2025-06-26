# **App Name**: HashNotes

## Core Features:

- AI Music Generation: Generate music using an LSTM model based on a seed generated from a timestamp or user-provided text input. The LLM acts as a tool by conditionally incorporating musical ideas depending on its interpretations of text prompts.
- Instrument Selection: Allow users to select from a range of instruments including piano, guitar, violin, flute, synth/pad, and percussion.
- Live Music Playback: Provide controls for playing, pausing, and restarting the generated music, as well as tempo control and a volume slider.
- Seed Text Customization: Enable users to enter custom text to generate music seeds, with real-time feedback on whether the hash will change. Save and copy the seed string + hash output.
- Share Feature: Implement a share feature with a link containing the embedded seed, allowing users to easily share and regenerate the same track.
- Session Management: Automatically save the generated track in localStorage and maintain a history of recent hashes for easy re-generation from previous sessions.

## Style Guidelines:

- Primary color: A vibrant purple (#A06CD5), inspired by the mystical nature of algorithmic composition.
- Background color: Dark grey (#222222), providing a professional feel suitable for digital creative work.
- Accent color: A bright, contrasting pink (#E64AC9), highlighting controls to help users take control of generative elements in a way that is exciting.
- Body and headline font: 'Space Grotesk' (sans-serif) for headlines and short text, paired with 'Inter' (sans-serif) for longer text, providing a techy, modern feel.
- Use minimalist, geometric icons to represent musical elements and controls.
- Implement a responsive layout that adapts to both mobile and desktop screens, ensuring a seamless user experience across devices.
- Incorporate subtle animations for visual feedback on user interactions.