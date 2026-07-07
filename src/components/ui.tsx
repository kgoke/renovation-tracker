import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Space, Type, useTheme } from './theme';

/** Scrollable screen container with themed background and safe bottom inset. */
export function Screen({
  children,
  padded = true,
  scroll = true,
}: {
  children: React.ReactNode;
  padded?: boolean;
  scroll?: boolean;
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const padding = padded ? Space.lg : 0;
  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding }}>{children}</View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding, paddingBottom: insets.bottom + 96 }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const colors = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: Space.lg,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  const colors = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[Type.subheading, { color: colors.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[Type.label, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message?: string }) {
  const colors = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[Type.subheading, { color: colors.textSecondary, textAlign: 'center' }]}>
        {title}
      </Text>
      {message ? (
        <Text
          style={[
            Type.body,
            { color: colors.textMuted, textAlign: 'center', marginTop: Space.xs },
          ]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

export function Loading() {
  const colors = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function Chip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'accent' | 'danger' | 'success' | 'warning';
}) {
  const colors = useTheme();
  const tones = {
    neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    accent: { bg: colors.accentSoft, fg: colors.accent },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    success: { bg: colors.successSoft, fg: colors.success },
    warning: { bg: colors.warningSoft, fg: colors.warning },
  } as const;
  const t = tones[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      <Text style={[Type.caption, { color: t.fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
}) {
  const colors = useTheme();
  const variants = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: 'transparent' },
    secondary: { bg: colors.surfaceAlt, fg: colors.text, border: colors.border },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  } as const;
  const v = variants[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[Type.subheading, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Floating action button pinned bottom-right. */
export function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.primary,
          bottom: insets.bottom + Space.xl,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text style={[Type.subheading, { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  rightSub,
  onPress,
  chip,
}: {
  title: string;
  subtitle?: string;
  right?: string;
  rightSub?: string;
  onPress?: () => void;
  chip?: React.ReactNode;
}) {
  const colors = useTheme();
  const content = (
    <View style={styles.rowInner}>
      <View style={{ flex: 1, marginRight: Space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <Text style={[Type.body, { color: colors.text, fontWeight: '600', flexShrink: 1 }]} numberOfLines={1}>
            {title}
          </Text>
          {chip}
        </View>
        {subtitle ? (
          <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {right ? <Text style={[Type.body, { color: colors.text, fontWeight: '600' }]}>{right}</Text> : null}
        {rightSub ? (
          <Text style={[Type.caption, { color: colors.textMuted, marginTop: 2 }]}>{rightSub}</Text>
        ) : null}
      </View>
    </View>
  );
  const rowStyle = {
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.8 : 1 }]}>
        {content}
      </Pressable>
    );
  }
  return <View style={rowStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.xl,
    marginBottom: Space.md,
  },
  empty: {
    paddingVertical: Space.xxl,
    paddingHorizontal: Space.xl,
    alignItems: 'center',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Space.xxl },
  chip: {
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  button: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: Space.xl,
    paddingHorizontal: Space.xl,
    paddingVertical: 14,
    borderRadius: Radius.full,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Space.lg,
  },
});
