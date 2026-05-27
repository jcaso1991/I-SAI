import { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "./api";
import { useThemedStyles } from "./theme";
import { ios } from "./ui/iosTheme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRIORITY_COLORS: Record<string, string> = {
  alta: "#EF4444",
  media: "#F59E0B",
  baja: "#10B981",
};

type NoteData = {
  id: string;
  titulo: string;
  contenido: string;
  fecha: string;
  material_id?: string;
  material_name?: string;
  marcada?: boolean;
  color?: string | null;
  priority?: string | null;
  tags?: string[];
  pinned?: boolean;
  archived?: boolean;
  updated_at?: string;
};

type Props = {
  note: NoteData;
  onPress?: () => void;
  onFlag?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onPin?: () => void;
  onArchive?: () => void;
  onEditColor?: (color: string | null) => void;
  onEditPriority?: (p: string | null) => void;
  onEditTags?: (tags: string[]) => void;
  onEditDate?: (date: string | null) => void;
  onLinkProject?: () => void;
  compact?: boolean;
};

export function NoteCard({
  note,
  onPress,
  onFlag,
  onDelete,
  onPin,
  onArchive,
  onLinkProject,
  compact = false,
}: Props) {
  const s = useThemedStyles(() => StyleSheet.create(staticStyles()));

  const animate = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  }, []);

  const handlePin = useCallback(() => {
    animate();
    onPin?.();
  }, [animate, onPin]);

  const handleFlag = useCallback(() => {
    animate();
    onFlag?.();
  }, [animate, onFlag]);

  const handleArchive = useCallback(() => {
    animate();
    onArchive?.();
  }, [animate, onArchive]);

  const priorityColor = note.priority
    ? PRIORITY_COLORS[note.priority]
    : undefined;

  const cardBg = note.color || COLORS.surface;

  if (compact) {
    return (
      <TouchableOpacity
        style={[s.card, s.compact, { backgroundColor: cardBg }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={s.compactRow}>
          {priorityColor && (
            <View
              style={[s.priorityDot, { backgroundColor: priorityColor }]}
            />
          )}
          <Text style={s.compactTitle} numberOfLines={1}>
            {note.titulo}
          </Text>
          <Text style={s.compactDate}>
            {note.fecha
              ? new Date(note.fecha).toLocaleDateString("es-AR")
              : ""}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: cardBg }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.header}>
        <Text style={s.date}>
          {note.fecha
            ? new Date(note.fecha).toLocaleDateString("es-AR")
            : ""}
        </Text>
        <View style={s.actions}>
          {onPin && (
            <TouchableOpacity onPress={handlePin} hitSlop={8}>
              <Ionicons
                name={note.pinned ? "pin" : "pin-outline"}
                size={16}
                color={note.pinned ? COLORS.primary : COLORS.textDisabled}
              />
            </TouchableOpacity>
          )}
          {onFlag && (
            <TouchableOpacity onPress={handleFlag} hitSlop={8}>
              <Ionicons
                name={note.marcada ? "flag" : "flag-outline"}
                size={16}
                color={note.marcada ? "#EF4444" : COLORS.textDisabled}
              />
            </TouchableOpacity>
          )}
          {onArchive && (
            <TouchableOpacity onPress={handleArchive} hitSlop={8}>
              <Ionicons
                name={note.archived ? "archive" : "archive-outline"}
                size={16}
                color={COLORS.textDisabled}
              />
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity onPress={onDelete} hitSlop={8}>
              <Ionicons
                name="trash-outline"
                size={16}
                color={COLORS.textDisabled}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={s.titleRow}>
        {priorityColor && (
          <View
            style={[s.priorityDot, { backgroundColor: priorityColor }]}
          />
        )}
        <Text style={s.title} numberOfLines={2}>
          {note.titulo}
        </Text>
      </View>

      {note.contenido ? (
        <Text style={s.contentPreview} numberOfLines={2}>
          {note.contenido}
        </Text>
      ) : null}

      {note.material_name ? (
        <TouchableOpacity
          style={s.materialChip}
          onPress={onLinkProject}
          disabled={!onLinkProject}
        >
          <Ionicons name="link-outline" size={12} color={COLORS.primary} />
          <Text style={s.materialChipText} numberOfLines={1}>
            {note.material_name}
          </Text>
        </TouchableOpacity>
      ) : null}

      {note.tags && note.tags.length > 0 ? (
        <View style={s.tagsRow}>
          {note.tags.map((tag, i) => (
            <View key={i} style={s.tagChip}>
              <Text style={s.tagText} numberOfLines={1}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function staticStyles() {
  return {
    card: {
      borderRadius: ios.radius.card,
      borderWidth: 1,
      borderColor: COLORS.border,
      padding: ios.spacing.md,
      ...ios.shadow.card,
    },
    compact: {
      height: 40,
      justifyContent: "center" as const,
      paddingVertical: ios.spacing.xs,
    },
    compactRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: ios.spacing.sm,
    },
    compactTitle: {
      flex: 1,
      fontSize: ios.font.subhead.size,
      fontWeight: "500" as const,
      color: COLORS.text,
    },
    compactDate: {
      fontSize: ios.font.caption.size,
      color: COLORS.textDisabled,
    },
    header: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginBottom: ios.spacing.sm,
    },
    date: {
      fontSize: ios.font.caption.size,
      color: COLORS.textDisabled,
    },
    actions: {
      flexDirection: "row" as const,
      gap: ios.spacing.md,
    },
    titleRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: ios.spacing.sm,
      marginBottom: ios.spacing.xs,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    title: {
      flex: 1,
      fontWeight: "600" as const,
      fontSize: ios.font.subhead.size,
      color: COLORS.text,
    },
    contentPreview: {
      fontSize: ios.font.footnote.size,
      color: COLORS.textSecondary,
      marginBottom: ios.spacing.sm,
      lineHeight: ios.font.footnote.lh,
    },
    materialChip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      alignSelf: "flex-start" as const,
      backgroundColor: COLORS.primarySoft,
      borderRadius: ios.radius.sm,
      paddingHorizontal: ios.spacing.sm,
      paddingVertical: ios.spacing.xs,
      gap: 4,
      marginBottom: ios.spacing.sm,
    },
    materialChipText: {
      fontSize: 10,
      color: COLORS.primary,
      maxWidth: 120,
    },
    tagsRow: {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      gap: ios.spacing.xs,
    },
    tagChip: {
      backgroundColor: COLORS.border,
      borderRadius: ios.radius.sm,
      paddingHorizontal: ios.spacing.sm,
      paddingVertical: 2,
    },
    tagText: {
      fontSize: 10,
      color: COLORS.textSecondary,
    },
  };
}
