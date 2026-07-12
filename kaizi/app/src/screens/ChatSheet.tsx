/**
 * Chat sheet — real Claude-backed companion chat (world-build-plan.md),
 * layered over the World via the shared Sheet primitive. The other two
 * sheets (Intentions, Reflection) reuse this same primitive/pattern.
 */
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Line, Polygon } from "react-native-svg";

import { getChatMessages, sendChatMessage, type ChatMessage } from "../api/client";
import { ChatBubble } from "../ui/ChatBubble";
import { CompanionAvatar } from "../ui/CompanionAvatar";
import { CompanionVoice } from "../ui/CompanionVoice";
import { Sheet } from "../ui/Sheet";
import { font, gold, hue, line, mist, radius, text, type } from "../ui/tokens";
import { useWorld } from "../state/WorldContext";

interface ChatSheetProps {
  visible: boolean;
  onClose: () => void;
  companionName: string;
}

export function ChatSheet({ visible, onClose, companionName }: ChatSheetProps) {
  const { state } = useWorld();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const loadedFor = useRef(false);

  useEffect(() => {
    if (!visible || loadedFor.current) return;
    loadedFor.current = true;
    void (async () => {
      const history = await getChatMessages(state.identity.sessionToken);
      if (history === null) {
        setLoadError(true);
        return;
      }
      setMessages(history);
    })();
  }, [visible, state.identity.sessionToken]);

  useEffect(() => {
    if (!visible) loadedFor.current = false;
  }, [visible]);

  const handleSend = () => {
    const content = draft.trim();
    if (content.length === 0 || sending) return;
    setDraft("");
    setSending(true);
    // Optimistic append so the companion feels responsive while the real
    // Claude call is in flight.
    const optimistic: ChatMessage = {
      id: `pending-${Date.now()}`,
      user_id: "",
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);
    void (async () => {
      const result = await sendChatMessage(content, state.identity.sessionToken);
      setSending(false);
      if (result === null) {
        setLoadError(true);
        return;
      }
      setMessages((prev) => {
        const withoutOptimistic = (prev ?? []).filter((m) => m.id !== optimistic.id);
        return [...withoutOptimistic, result.userMessage, result.companionMessage];
      });
    })();
  };

  return (
    <Sheet visible={visible} onClose={onClose} maxHeightPct={0.86} style={styles.sheet}>
      <View style={styles.headerRow}>
        <View style={styles.avatarSlot}>
          <CompanionAvatar species={state.companion} size={30} animated={false} />
        </View>
        <View>
          <Text style={styles.name}>{companionName}</Text>
          <Text style={styles.sub}>Your companion · in the garden</Text>
        </View>
      </View>

      <View style={styles.messages}>
        {messages === null ? (
          <Text style={styles.hint}>{loadError ? "Couldn't reach the garden right now." : "Listening…"}</Text>
        ) : messages.length === 0 ? (
          <Text style={styles.hint}>Say something to start the conversation.</Text>
        ) : (
          messages.slice(-30).map((m) => (
            <View key={m.id} style={m.role === "companion" ? styles.rowLeft : styles.rowRight}>
              <ChatBubble role={m.role}>
                {m.role === "companion" ? (
                  <CompanionVoice size={15}>{m.content}</CompanionVoice>
                ) : (
                  <Text style={type.bodySans}>{m.content}</Text>
                )}
              </ChatBubble>
            </View>
          ))
        )}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={`Say something to ${companionName}...`}
          placeholderTextColor={text.faint}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          onPress={handleSend}
          disabled={sending || draft.trim().length === 0}
          style={[styles.sendBtn, sending || draft.trim().length === 0 ? styles.sendBtnDisabled : null]}
        >
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={gold.solid} strokeWidth={2}>
            <Line x1={22} y1={2} x2={11} y2={13} />
            <Polygon points="22,2 15,22 11,13 2,9" />
          </Svg>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  avatarSlot: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: gold.fill10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: gold.line20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  name: {
    fontFamily: font.serifLight,
    fontSize: 16,
    color: hue.cream,
  },
  sub: {
    ...type.meta,
    fontSize: 10,
    color: text.faint,
  },
  messages: {
    minHeight: 160,
    maxHeight: 340,
    gap: 10,
  },
  hint: {
    fontFamily: font.serifLightItalic,
    fontSize: 13,
    color: text.faint,
    textAlign: "center",
    marginTop: 24,
  },
  rowLeft: {
    alignItems: "flex-start",
  },
  rowRight: {
    alignItems: "flex-end",
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  input: {
    flex: 1,
    backgroundColor: mist[5],
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: line[12],
    borderRadius: radius.pill,
    paddingVertical: 11,
    paddingHorizontal: 16,
    ...type.bodySans,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: gold.fill20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: gold.line30,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});
