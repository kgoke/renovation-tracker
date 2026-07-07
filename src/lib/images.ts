/**
 * Image persistence. Photos picked from the camera/gallery live in temporary
 * cache locations, so anything the user attaches is copied into a permanent
 * app-private folder under the document directory.
 */

import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const IMAGES_DIR = 'images';

function imagesDirectory(): Directory {
  const dir = new Directory(Paths.document, IMAGES_DIR);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Copy a picked image into permanent app storage; returns the stored URI. */
export async function persistImage(sourceUri: string): Promise<string> {
  const dir = imagesDirectory();
  const extMatch = /\.(jpe?g|png|webp|heic|heif)$/i.exec(sourceUri);
  const ext = extMatch ? extMatch[0].toLowerCase() : '.jpg';
  const name = `img_${Date.now()}_${Math.floor(Math.random() * 1e6)}${ext}`;
  const dest = new File(dir, name);
  await new File(sourceUri).copy(dest);
  return dest.uri;
}

/** Delete a stored image; ignores files that are already gone. */
export function deleteImage(uri: string | null | undefined): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Losing an orphaned file is not worth surfacing to the user.
  }
}

export interface PickedImage {
  uri: string;
}

/** Launch the camera and return the captured photo (not yet persisted). */
export async function captureImage(): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return { uri: result.assets[0].uri };
}

/** Open the photo library and return the chosen image (not yet persisted). */
export async function pickImage(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return { uri: result.assets[0].uri };
}
