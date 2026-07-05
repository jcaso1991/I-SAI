import React, { useRef, useState, useCallback } from "react";
import {
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
  const recognitionRef = useRef<any>(null);
  const startedAtRef = useRef(0);

  const cleanup = useCallback(() => {
    const r = recognitionRef.current;
    if (r) {
      try { r.abort(); } catch (_) {}
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const win = window as any;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert("No soportado", "Tu navegador no admite reconocimiento de voz. Usá Chrome o Edge.");
      return;
    }

    try {
      cleanup();

      const rec = new SpeechRecognition();
      rec.lang = "es-ES";
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;

      recognitionRef.current = rec;
      startedAtRef.current = Date.now();

      rec.onresult = (event: any) => {
        const last = event.results[event.results.length - 1];
        if (!last.isFinal) return;
        const transcript = last[0].transcript.trim();
        if (!transcript) return;

        // Detuvimos reconocimiento y procesamos con IA
        try { rec.abort(); } catch (_) {}
        recognitionRef.current = null;
        setListening(false);
        setProcessing(true);

        api.voiceParse(transcript)
          .then((parsed: any) => {
            onFill(parsed);
            Alert.alert("Listo", "Campos rellenados con la IA. Revisalos antes de guardar.");
          })
          .catch((e: any) => {
            Alert.alert("Error", e.message || "La IA no pudo interpretar el texto.");
          })
          .finally(() => setProcessing(false));
      };

      rec.onerror = (event: any) => {
        if (event.error === "aborted") return;
        recognitionRef.current = null;
        setListening(false);
        if (event.error === "no-speech") {
          Alert.alert("Sin audio", "No detecté ninguna voz. Probá de nuevo.");
        } else if (event.error === "not-allowed") {
          Alert.alert("Micrófono bloqueado", "Permití el micrófono desde la configuración del navegador.");
        } else {
          Alert.alert("Error de voz", event.error);
        }
      };

      rec.onend = () => {
        const elapsed = Date.now() - startedAtRef.current;
        // Bug de Chrome: onend se dispara inmediatamente sin detectar nada.
        // Si pasó menos de 1s y tenemos el ref vivo, reintentamos.
        if (elapsed < 1000 && recognitionRef.current === rec) {
          try { rec.start(); } catch (_) {
            recognitionRef.current = null;
            setListening(false);
          }
          return;
        }
        // Reconocimiento terminó normalmente (por abort desde onresult o por timeout)
        if (recognitionRef.current === rec) {
          recognitionRef.current = null;
          setListening(false);
        }
      };

      rec.start();
      setListening(true);
    } catch (e: any) {
      Alert.alert("Error", "No se pudo iniciar el micrófono: " + (e.message || "desconocido"));
    }
  }, [cleanup, onFill]);

  const toggle = useCallback(() => {
    if (processing) return;
    if (listening) {
      cleanup();
    } else {
      startListening();
    }
  }, [processing, listening, cleanup, startListening]);

  return (
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
  );
}
