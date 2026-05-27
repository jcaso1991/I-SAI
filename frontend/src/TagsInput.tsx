import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "./api";
import { useThemedStyles } from "./theme";
import { ios } from "./ui/iosTheme";

type Props = {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
};

export function TagsInput({ tags, onChange, placeholder = "Agregar etiqueta..." }: Props) {
  const s = useThemedStyles(() => StyleSheet.create(staticStyles()));
  const [text, setText] = useState("");
  const inputRef = useRef<TextInput>(null);

  const addTag = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setText("");
  }, [text, tags, onChange]);

  const removeTag = useCallback(
    (index: number) => {
      onChange(tags.filter((_, i) => i !== index));
    },
    [tags, onChange]
  );

  const handleKeyPress = useCallback(
    (e: { nativeEvent: { key: string } }) => {
      if (e.nativeEvent.key === "Enter") {
        addTag();
      }
    },
    [addTag]
  );

  return (
    <View style={s.container}>
      {tags.length > 0 && (
        <View style={s.chipsRow}>
          {tags.map((tag, i) => (
            <View key={i} style={s.chip}>
              <Text style={s.chipText} numberOfLines={1}>
                {tag}
              </Text>
              <TouchableOpacity
                onPress={() => removeTag(i)}
                hitSlop={6}
                style={s.chipRemove}
              >
                <Ionicons
                  name="close"
                  size={12}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
      <TextInput
        ref={inputRef}
        style={s.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textDisabled}
        value={text}
        onChangeText={setText}
        onSubmitEditing={addTag}
        onKeyPress={handleKeyPress}
        returnKeyType="done"
        blurOnSubmit={false}
      />
    </View>
  );
}

function staticStyles() {
  return {
    container: {
      marginBottom: ios.spacing.sm,
    },
    chipsRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: ios.spacing.xs,
      marginBottom: ios.spacing.sm,
    },
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: COLORS.primarySoft,
      borderRadius: ios.radius.sm,
      paddingLeft: ios.spacing.sm,
      paddingRight: ios.spacing.xs,
      paddingVertical: ios.spacing.xs,
      gap: 2,
    },
    chipText: {
      fontSize: ios.font.caption.size,
      color: COLORS.primary,
      maxWidth: 120,
    },
    chipRemove: {
      padding: 2,
    },
    input: {
      fontSize: ios.font.caption.size,
      color: COLORS.text,
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: ios.radius.sm,
      paddingHorizontal: ios.spacing.sm,
      paddingVertical: ios.spacing.xs,
    },
  };
}
