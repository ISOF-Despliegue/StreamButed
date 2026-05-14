import { API_BASE_URL, apiRequest } from "./apiClient";
import type { AssetUploadResponse, CatalogImageUsage } from "../types/media.types";

const API_PREFIX = "/api/v1";
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_CATALOG_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/flac",
  "audio/x-flac",
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/x-m4a",
  "video/mp4",
]);

const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  webm: "audio/webm",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
};

function assertFile(file: File | null | undefined, message: string): asserts file is File {
  if (!file) {
    throw new Error(message);
  }
}

function getAcceptedType(file: File): string {
  if (file.type) {
    return file.type.toLowerCase();
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? "";
}

function assertAcceptedFile(file: File, allowedTypes: Set<string>, maxBytes: number, label: string): void {
  if (!allowedTypes.has(getAcceptedType(file))) {
    throw new Error(`${label} tiene un tipo de archivo no permitido.`);
  }

  if (file.size > maxBytes) {
    throw new Error(`${label} supera el tamano maximo permitido.`);
  }
}

function fileFormData(file: File): FormData {
  const formData = new FormData();
  formData.set("file", file);
  return formData;
}

export function getAssetUrl(assetId: string): string {
  return `${API_BASE_URL}${API_PREFIX}/media/assets/${assetId}`;
}

export const mediaService = {
  uploadProfileImage(file: File): Promise<AssetUploadResponse> {
    assertFile(file, "Selecciona una imagen de perfil.");
    assertAcceptedFile(file, IMAGE_TYPES, MAX_PROFILE_IMAGE_BYTES, "La imagen de perfil");

    return apiRequest<AssetUploadResponse>("/media/profile-image", {
      method: "POST",
      body: fileFormData(file),
    });
  },

  uploadAudio(file: File): Promise<AssetUploadResponse> {
    assertFile(file, "Selecciona un archivo de audio.");
    assertAcceptedFile(file, AUDIO_TYPES, MAX_AUDIO_BYTES, "El audio");

    return apiRequest<AssetUploadResponse>("/media/audio", {
      method: "POST",
      body: fileFormData(file),
    });
  },

  uploadCatalogImage(file: File, usage: CatalogImageUsage): Promise<AssetUploadResponse> {
    assertFile(file, "Selecciona una imagen de portada.");
    assertAcceptedFile(file, IMAGE_TYPES, MAX_CATALOG_IMAGE_BYTES, "La portada");

    const formData = fileFormData(file);
    formData.set("usage", usage);

    return apiRequest<AssetUploadResponse>("/media/images", {
      method: "POST",
      body: formData,
    });
  },
};
