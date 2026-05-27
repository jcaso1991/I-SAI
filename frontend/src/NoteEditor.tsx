import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { COLORS } from "./api";
import { useThemedStyles } from "./theme";
import { ios } from "./ui/iosTheme";
import { TagsInput } from "./TagsInput";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLOR_OPTIONS = [
  { color: "#FEF3C7", label: "Amarillo" },
  { color: "#DCFCE7", label: "Verde" },
  { color: "#DBEAFE", label: "Azul" },
  { color: "#FCE7F3", label: "Rosa" },
  { color: "#EDE9FE", label: "Lila" },
  { color: "#F3F4F6", label: "Gris" },
];

const PRIORITY_OPTIONS = [
  { key: "alta", color: "#EF4444", label: "Alta" },
  { key: "media", color: "#F59E0B", label: "Media" },
  { key: "baja", color: "#10B981", label: "Baja" },
];

type NoteData = {
  titulo?: string;
  contenido?: string;
  fecha?: string | null;
  material_id?: string | null;
  marcada?: boolean;
  color?: string | null;
  priority?: string | null;
  tags?: string[];
  pinned?: boolean;
};

type Props = {
  note?: Partial<NoteData>;
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
};

export function NoteEditor({ note, onSave, onCancel }: Props) {
  const s = useThemedStyles(() => StyleSheet.create(staticStyles()));

  const [titulo, setTitulo] = useState(note?.titulo ?? "");
  const [contenido, setContenido] = useState(note?.contenido ?? "");
  const [color, setColor] = useState<string | null>(note?.color ?? null);
  const [priority, setPriority] = useState<string | null>(
    note?.priority ?? null
  );
  const [tags, setTags] = useState<string[]>(note?.tags ?? []);
  const [fecha, setFecha] = useState(note?.fecha ?? null);

  const animate = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const handleSave = useCallback(() => {
    onSave({
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      color,
      priority,
      tags,
      fecha,
    });
  }, [titulo, contenido, color, priority, tags, fecha, onSave]);

  const toggleColor = useCallback(
    (c: string) => {
      animate();
      setColor((prev) => (prev === c ? null : c));
    },
    [animate]
  );

  const clearColor = useCallback(() => {
    animate();
    setColor(null);
  }, [animate]);

  const togglePriority = useCallback(
    (p: string) => {
      animate();
      setPriority((prev) => (prev === p ? null : p));
    },
    [animate]
  );

  return (
    <View style={s.card}>
      <TextInput
        style={s.titleInput}
        placeholder="Título de la nota"
        placeholderTextColor={COLORS.textDisabled}
        value={titulo}
        onChangeText={setTitulo}
        returnKeyType="next"
      />

      <TextInput
        style={s.contentInput}
        placeholder="Escribí algo..."
        placeholderTextColor={COLORS.textDisabled}
        value={contenido}
        onChangeText={setContenido}
        multiline
        textAlignVertical="top"
      />

      <View style={s.toolsSection}>
        <Text style={s.toolsLabel}>Color</Text>
        <View style={s.colorRow}>
          {COLOR_OPTIONS.map((opt) => {
            const selected = color === opt.color;
            return (
              <TouchableOpacity
                key={opt.color}
                onPress={() => toggleColor(opt.color)}
                style={[
                  s.colorDot,
                  { backgroundColor: opt.color },
                  selected && s.colorDotSelected,
                ]}
                hitSlop={6}
              />
            );
          })}
          <TouchableOpacity
            onPress={clearColor}
            style={[s.colorDot, s.noColorDot, !color && s.colorDotSelected]}
            hitSlop={6}
          >
            <View style={s.noColorLine} />
          </TouchableOpacity>
        </View>

        <Text style={s.toolsLabel}>Prioridad</Text>
        <View style={s.priorityRow}>
          {PRIORITY_OPTIONS.map((opt) => {
            const selected = priority === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => togglePriority(opt.key)}
                style={[
                  s.priorityChip,
                  selected && {
                    backgroundColor: opt.color + "20",
                    borderColor: opt.color,
                  },
                ]}
              >
                <View
                  style={[s.priorityDotSmall, { backgroundColor: opt.color }]}
                />
                <Text
                  style={[
                    s.priorityChipText,
                    selected && { color: opt.color },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.toolsLabel}>Fecha</Text>
        <TextInput
          style={s.dateInput}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={COLORS.textDisabled}
          value={fecha ?? ""}
          onChangeText={(t) => setFecha(t || null)}
          keyboardType="default"
        />

        <Text style={s.toolsLabel}>Etiquetas</Text>
        <TagsInput
          tags={tags}
          onChange={setTags}
          placeholder="Agregar etiqueta..."
        />
      </View>

      <View style={s.buttonsRow}>
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
          <Text style={s.cancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
          <Text style={s.saveBtnText}>Guardar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function staticStyles() {
  return {
    card: {
      borderRadius: ios.radius.lg,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: ios.spacing.lg,
    },
    titleInput: {
      fontSize: ios.font.callout.size,
      fontWeight: "600" as const,
      color: COLORS.text,
      paddingVertical: ios.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,
      marginBottom: ios.spacing.sm,
    },
    contentInput: {
      fontSize: ios.font.body.size,
      color: COLORS.text,
      minHeight: 80,
      paddingVertical: ios.spacing.sm,
      lineHeight: ios.font.body.lh,
    },
    toolsSection: {
      marginTop: ios.spacing.md,
    },
    toolsLabel: {
      fontSize: ios.font.caption.size,
      fontWeight: "600" as const,
      color: COLORS.textDisabled,
      marginBottom: ios.spacing.xs,
      marginTop: ios.spacing.sm,
    },
    colorRow: {
      flexDirection: "row" as const,
      gap: ios.spacing.sm,
      alignItems: "center" as const,
      marginBottom: ios.spacing.sm,
    },
    colorDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: "transparent",
    },
    colorDotSelected: {
      borderColor: COLORS.primary,
      borderWidth: 2,
    },
    noColorDot: {
      backgroundColor: COLORS.surface,
      borderWidth: 1,
      borderColor: COLORS.border,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    noColorLine: {
      width: 14,
      height: 2,
      backgroundColor: COLORS.textDisabled,
      transform: [{ rotate: "-45deg" }],
    },
    priorityRow: {
      flexDirection: "row" as const,
      gap: ios.spacing.sm,
      marginBottom: ios.spacing.sm,
    },
    priorityChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      paddingHorizontal: ios.spacing.sm,
      paddingVertical: ios.spacing.xs,
      borderRadius: ios.radius.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    priorityDotSmall: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    priorityChipText: {
      fontSize: ios.font.caption.size,
      color: COLORS.textSecondary,
    },
    dateInput: {
      fontSize: ios.font.caption.size,
      color: COLORS.text,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: ios.radius.sm,
      paddingHorizontal: ios.spacing.sm,
      paddingVertical: ios.spacing.xs,
      marginBottom: ios.spacing.sm,
    },
    buttonsRow: {
      flexDirection: "row" as const,
      justifyContent: "flex-end" as const,
      gap: ios.spacing.sm,
      marginTop: ios.spacing.lg,
    },
    saveBtn: {
      backgroundColor: COLORS.primary,
      paddingHorizontal: ios.spacing.xl,
      paddingVertical: ios.spacing.sm,
      borderRadius: ios.radius.sm,
    },
    saveBtnText: {
      color: "#FFFFFF",
      fontSize: ios.font.callout.size,
      fontWeight: "600" as const,
    },
    cancelBtn: {
      paddingHorizontal: ios.spacing.xl,
      paddingVertical: ios.spacing.sm,
      borderRadius: ios.radius.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    cancelBtnText: {
      color: COLORS.textSecondary,
      fontSize: ios.font.callout.size,
    },
  };
}
