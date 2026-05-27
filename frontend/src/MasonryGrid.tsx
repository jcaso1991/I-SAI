import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useThemedStyles } from "./theme";
import { useBreakpoint } from "./useBreakpoint";
import { ios } from "./ui/iosTheme";

type Props = {
  children: React.ReactNode[];
  columns?: number;
};

export function MasonryGrid({ children, columns = 3 }: Props) {
  const s = useThemedStyles(() => StyleSheet.create(staticStyles()));
  const { isMobile } = useBreakpoint();

  const distributed = useMemo(() => {
    if (isMobile || columns <= 1) {
      return [children];
    }

    const cols: React.ReactNode[][] = Array.from(
      { length: columns },
      () => []
    );

    children.forEach((child, i) => {
      cols[i % columns].push(child);
    });

    return cols;
  }, [children, columns, isMobile]);

  if (isMobile || columns <= 1) {
    return (
      <View style={s.mobileContainer}>
        {children.map((child, i) => (
          <View key={i} style={s.item}>
            {child}
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={s.desktopContainer}>
      {distributed.map((colChildren, colIdx) => (
        <View key={colIdx} style={s.column}>
          {colChildren.map((child, childIdx) => (
            <View key={`${colIdx}-${childIdx}`} style={s.item}>
              {child}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function staticStyles() {
  return {
    mobileContainer: {
      gap: ios.spacing.md,
    },
    item: {
      marginBottom: ios.spacing.md,
    },
    desktopContainer: {
      flexDirection: "row" as const,
      gap: ios.spacing.md,
    },
    column: {
      flex: 1,
      gap: ios.spacing.md,
    },
  };
}
