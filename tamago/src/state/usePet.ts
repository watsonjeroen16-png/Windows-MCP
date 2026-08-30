import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { Action, PetState, applyAction, newPet, tick } from "./petLogic";

const STORAGE_KEY = "tamago.pet.v1";
const TICK_INTERVAL_MS = 30_000;

interface UsePet {
  pet: PetState | null;
  loading: boolean;
  createPet: (name: string, faceUri: string) => void;
  act: (action: Action) => void;
  setFace: (faceUri: string) => void;
  resetPet: () => void;
}

/**
 * Owns the pet state: loads it from AsyncStorage on mount, replays elapsed
 * time, re-ticks every 30s and on foreground, and persists every change.
 */
export function usePet(): UsePet {
  const [pet, setPet] = useState<PetState | null>(null);
  const [loading, setLoading] = useState(true);
  const petRef = useRef<PetState | null>(null);
  petRef.current = pet;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          setPet(tick(JSON.parse(raw) as PetState, Date.now()));
        }
      } catch {
        // Corrupt or unreadable save: start fresh rather than crash.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pet) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pet)).catch(() => {});
    }
  }, [pet]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (petRef.current) setPet(tick(petRef.current, Date.now()));
    }, TICK_INTERVAL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && petRef.current) {
        setPet(tick(petRef.current, Date.now()));
      }
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  const createPet = useCallback((name: string, faceUri: string) => {
    setPet(newPet(name, faceUri, Date.now()));
  }, []);

  const act = useCallback((action: Action) => {
    setPet((prev) => (prev ? applyAction(prev, action, Date.now()) : prev));
  }, []);

  const setFace = useCallback((faceUri: string) => {
    setPet((prev) => (prev ? { ...prev, faceUri } : prev));
  }, []);

  const resetPet = useCallback(() => {
    setPet(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return { pet, loading, createPet, act, setFace, resetPet };
}
