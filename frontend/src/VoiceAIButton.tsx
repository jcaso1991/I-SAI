import React, { useRef, useState, useEffect } from "react";
import {
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
  Easing,
  View,
  Text,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, COLORS } from "./api";
import { ios } from "./ui/iosTheme";

interface Props {
  onFill: (fields: Record<string, any>) => void;
  size?: number;
}

export default function VoiceAIButton({ onFill, size = 40 }: Props) {
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (listening) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.2, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        ]),
      );
      anim.start();
    } else {
      pulse.setValue(1);
    }
    return () => { anim?.stop(); };
  }, [listening]);

  const stopRecognition = () => {
    const r = recognitionRef.current;
    if (r) {
      try { r.stop(); } catch (_) {}
      try { r.abort(); } catch (_) {}
      recognitionRef.current = null;
    }
    setListening(false);
  };

  const startListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      Alert.alert("No soportado", "Tu navegador no admite reconocimiento de voz. Usá Chrome o Edge.");
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = "es-ES";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.continuous = false;

      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript.trim();
        if (!transcript) return;
        stopRecognition();
        setProcessing(true);

        try {
          const parsed = await api.voiceParse(transcript);
          onFill(parsed);
          Alert.alert("Listo", "Campos rellenados con la IA. Revisalos antes de guardar.");
        } catch (e: any) {
          Alert.alert("Error", e.message || "La IA no pudo interpretar el texto.");
        } finally {
          setProcessing(false);
        }
      };

      recognition.onerror = (event: any) => {
        stopRecognition();
        if (event.error === "no-speech") {
          Alert.alert("Sin audio", "No detecté ninguna voz. Probá de nuevo.");
        } else if (event.error !== "aborted") {
          Alert.alert("Error de voz", event.error);
        }
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch (e: any) {
      Alert.alert("Error", "No se pudo iniciar el micrófono: " + e.message);
    }
  };

  const toggle = () => {
    if (processing) return;
    if (listening) {
      stopRecognition();
    } else {
      startListening();
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <TouchableOpacity
        style={{
          width: size,
          height: size,
          borderRadius: ios.spacing.md,
          backgroundColor: processing ? COLORS.accent : listening ? COLORS.errorText : "#10B981",
          alignItems: "center",
          justifyContent: "center",
        }}
        onPress={toggle}
        disabled={processing}
        activeOpacity={0.7}
      >
        {processing ? (
          <ActivityIndicator color="#fff" size={size * 0.45} />
        ) : (
          <Ionicons
            name={listening ? "mic" : "mic-outline"}
            size={size * 0.5}
            color="#fff"
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
