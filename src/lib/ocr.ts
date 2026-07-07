/**
 * On-device OCR via Google ML Kit text recognition. The native module only
 * exists in a development/production build (`npx expo run:android`), not in
 * Expo Go — so it is loaded lazily and failures degrade to manual entry.
 */

export interface OcrResult {
  text: string;
}

export async function recognizeText(imageUri: string): Promise<OcrResult | null> {
  let recognizer: { recognize: (uri: string) => Promise<{ text: string }> };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    recognizer = require('@react-native-ml-kit/text-recognition').default;
  } catch {
    return null; // running in Expo Go — native module unavailable
  }
  try {
    const result = await recognizer.recognize(imageUri);
    return { text: result.text ?? '' };
  } catch {
    return null;
  }
}
