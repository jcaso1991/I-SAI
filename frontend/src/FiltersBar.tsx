import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "./api";
import { useThemedStyles } from "./theme";
import { ios } from "./ui/iosTheme";

type Props = {
  search: string;
  onSearchChange: (s: string) => void;
  priority: string | null;
  onPriorityChange: (p: string | null) => void;
  selectedTag: string | null;
  onTagChange: (t: string | null) => void;
  showMarked: boolean;
  onShowMarkedChange: (v: boolean) => void;
  showArchived: boolean;
  onShowArchivedChange: (v: boolean) => void;
  availableTags: string[];
  compact: "normal" | "expanded" | null;
  onCompactChange: (v: string | null) => void;
};

const PRIORITY_OPTIONS = [
  { key: "alta", label: "Alta", color: "#EF4444" },
  { key: "media", label: "Media", color: "#F59E0B" },
  { key: "baja", label: "Baja", color: "#10B981" },
];

export function FiltersBar({
  search,
  onSearchChange,
  priority,
  onPriorityChange,
  selectedTag,
  onTagChange,
  showMarked,
  onShowMarkedChange,
  showArchived,
  onShowArchivedChange,
  availableTags,
  compact,
  onCompactChange,
}: Props) {
  const s = useThemedStyles(() => StyleSheet.create(staticStyles()));
  const [localSearch, setLocalSearch] = useState(search);
  const [showTags, setShowTags] = useState(false);

  const handleSearchSubmit = useCallback(() => {
    onSearchChange(localSearch);
  }, [localSearch, onSearchChange]);

  const handleSearchChange = useCallback(
    (text: string) => {
      setLocalSearch(text);
      onSearchChange(text);
    },
    [onSearchChange]
  );

  const toggleMarked = useCallback(() => {
    onShowMarkedChange(!showMarked);
  }, [showMarked, onShowMarkedChange]);

  const toggleArchived = useCallback(() => {
    onShowArchivedChange(!showArchived);
  }, [showArchived, onShowArchivedChange]);

  const isFiltering =
    priority || selectedTag || showMarked || showArchived;

  const clearAll = useCallback(() => {
    onPriorityChange(null);
    onTagChange(null);
    onShowMarkedChange(false);
    onShowArchivedChange(false);
  }, [onPriorityChange, onTagChange, onShowMarkedChange, onShowArchivedChange]);

  return (
    <View style={s.container}>
      <View style={s.searchRow}>
        <Ionicons
          name="search-outline"
          size={18}
          color={COLORS.textDisabled}
          style={s.searchIcon}
        />
        <TextInput
          style={s.searchInput}
          placeholder="Buscar notas..."
          placeholderTextColor={COLORS.textDisabled}
          value={localSearch}
          onChangeText={handleSearchChange}
          onSubmitEditing={handleSearchSubmit}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chipsScroll}
      >
        <TouchableOpacity
          style={[s.chip, !isFiltering && s.chipActive]}
          onPress={clearAll}
        >
          <Text
            style={[s.chipText, !isFiltering && s.chipTextActive]}
          >
            Todas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.chip, showMarked && s.chipActive]}
          onPress={toggleMarked}
        >
          <Text style={[s.chipText, showMarked && s.chipTextActive]}>
            Marcadas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.chip, showArchived && s.chipActive]}
          onPress={toggleArchived}
        >
          <Text style={[s.chipText, showArchived && s.chipTextActive]}>
            Archivadas
          </Text>
        </TouchableOpacity>

        {PRIORITY_OPTIONS.map((opt) => {
          const sel = priority === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[s.chip, sel && { borderColor: opt.color }]}
              onPress={() =>
                onPriorityChange(sel ? null : opt.key)
              }
            >
              <View
                style={[s.chipDot, { backgroundColor: opt.color }]}
              />
              <Text
                style={[
                  s.chipText,
                  sel && { color: opt.color },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}

        {availableTags.length > 0 && (
          <>
            <TouchableOpacity
              style={[s.chip, showTags && s.chipActive]}
              onPress={() => setShowTags(!showTags)}
            >
              <Ionicons
                name="pricetag-outline"
                size={14}
                color={COLORS.textSecondary}
              />
              <Text style={s.chipText}>Etiquetas</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={s.compactToggle}
          onPress={() =>
            onCompactChange(
              compact === "expanded" ? "normal" : "expanded"
            )
          }
        >
          <Ionicons
            name={
              compact === "expanded"
                ? "list-outline"
                : "grid-outline"
            }
            size={18}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </ScrollView>

      {showTags && availableTags.length > 0 && (
        <View style={s.tagsPanel}>
          {availableTags.map((tag) => {
            const sel = selectedTag === tag;
            return (
              <TouchableOpacity
                key={tag}
                style={[s.tagOption, sel && s.tagOptionActive]}
                onPress={() => onTagChange(sel ? null : tag)}
              >
                <Text
                  style={[
                    s.tagOptionText,
                    sel && s.tagOptionTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function staticStyles() {
  return {
    container: {
      gap: ios.spacing.sm,
    },
    searchRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      borderRadius: ios.radius.pill,
      borderWidth: 1,
      borderColor: COLORS.border,
      height: 38,
      paddingHorizontal: ios.spacing.md,
    },
    searchIcon: {
      marginRight: ios.spacing.sm,
    },
    searchInput: {
      flex: 1,
      fontSize: ios.font.callout.size,
      color: COLORS.text,
      paddingVertical: 0,
    },
    chipsScroll: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: ios.spacing.sm,
      paddingVertical: ios.spacing.xs,
    },
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      paddingHorizontal: ios.spacing.md,
      paddingVertical: ios.spacing.xs,
      borderRadius: ios.radius.pill,
      borderWidth: 1,
      borderColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    chipActive: {
      backgroundColor: COLORS.primarySoft,
      borderColor: COLORS.primary,
    },
    chipText: {
      fontSize: ios.font.caption.size,
      color: COLORS.textSecondary,
    },
    chipTextActive: {
      color: COLORS.primary,
      fontWeight: "600" as const,
    },
    chipDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    compactToggle: {
      paddingHorizontal: ios.spacing.sm,
      paddingVertical: ios.spacing.xs,
    },
    tagsPanel: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: ios.spacing.sm,
      paddingVertical: ios.spacing.sm,
      paddingHorizontal: ios.spacing.xs,
      backgroundColor: COLORS.surface,
      borderRadius: ios.radius.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    tagOption: {
      paddingHorizontal: ios.spacing.sm,
      paddingVertical: 4,
      borderRadius: ios.radius.sm,
      borderWidth: 1,
      borderColor: COLORS.border,
    },
    tagOptionActive: {
      backgroundColor: COLORS.primarySoft,
      borderColor: COLORS.primary,
    },
    tagOptionText: {
      fontSize: ios.font.caption.size,
      color: COLORS.textSecondary,
    },
    tagOptionTextActive: {
      color: COLORS.primary,
    },
  };
}
