import { CameraView, useCameraPermissions } from "expo-camera";
import { File, Paths } from "expo-file-system";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "../theme";

interface Props {
  /** Called with the persisted face photo URI and chosen name. */
  onDone: (faceUri: string, name: string) => void;
  /** When re-scanning an existing pet, the name is kept and hidden. */
  existingName?: string;
}

/**
 * Onboarding: line your face up inside the oval, snap a selfie, and that
 * photo becomes your pet's face. The photo stays on-device.
 */
export default function ScanScreen({ onDone, existingName }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState(existingName ?? "");
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (photo?.uri) setPhotoUri(persistPhoto(photo.uri));
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (photoUri) onDone(photoUri, name.trim() || "Tama");
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Say cheese! 📸</Text>
        <Text style={styles.subtitle}>
          Tamago needs the front camera to scan your face so your pet looks like you. The photo
          never leaves your phone.
        </Text>
        <Pressable style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  if (photoUri) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{existingName ? "Looking good!" : "Meet your pet!"}</Text>
        <Image source={{ uri: photoUri }} style={styles.preview} />
        {!existingName && (
          <TextInput
            style={styles.nameInput}
            placeholder="Name your pet…"
            placeholderTextColor={colors.muted}
            value={name}
            onChangeText={setName}
            maxLength={12}
          />
        )}
        <Pressable style={styles.primaryButton} onPress={confirm}>
          <Text style={styles.primaryButtonText}>{existingName ? "Use this face" : "Hatch 🥚"}</Text>
        </Pressable>
        <Pressable onPress={() => setPhotoUri(null)}>
          <Text style={styles.retake}>Retake</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
      <View style={styles.overlay} pointerEvents="none">
        <Text style={styles.guideText}>Line your face up in the oval</Text>
        <View style={styles.faceGuide} />
      </View>
      <View style={styles.shutterRow}>
        <Pressable style={styles.shutter} onPress={capture} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.ink} /> : <View style={styles.shutterInner} />}
        </Pressable>
      </View>
    </View>
  );
}

/** Copy the cached capture into the document directory so it survives restarts. */
function persistPhoto(cacheUri: string): string {
  try {
    const src = new File(cacheUri);
    const dest = new File(Paths.document, `face-${Date.now()}.jpg`);
    src.copy(dest);
    return dest.uri;
  } catch {
    return cacheUri;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  title: { fontSize: 26, fontWeight: "800", color: colors.ink, textAlign: "center" },
  subtitle: { fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  guideText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  faceGuide: {
    width: 240,
    height: 320,
    borderRadius: 160,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    borderStyle: "dashed",
  },
  shutterRow: {
    position: "absolute",
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#fff" },
  preview: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 5,
    borderColor: colors.accent,
  },
  nameInput: {
    width: 220,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    fontSize: 20,
    textAlign: "center",
    color: colors.ink,
    paddingVertical: 8,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
  },
  primaryButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  retake: { color: colors.muted, fontSize: 15, textDecorationLine: "underline" },
});
