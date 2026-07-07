import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import { centsToInput, parseMoney } from '@/lib/money';
import { formatIso, isValidIso } from '@/lib/dates';
import { Radius, Space, Type, useTheme } from './theme';

export function FieldLabel({ text }: { text: string }) {
  const colors = useTheme();
  return <Text style={[Type.label, { color: colors.textSecondary, marginBottom: 6 }]}>{text}</Text>;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const colors = useTheme();
  return (
    <View style={styles.field}>
      <FieldLabel text={label} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        style={[
          styles.input,
          Type.body,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
            minHeight: multiline ? 88 : undefined,
            textAlignVertical: multiline ? 'top' : 'center',
          },
        ]}
      />
    </View>
  );
}

/**
 * Currency input backed by integer cents. Keeps its own text state so the
 * user can type freely; commits parsed cents on every change.
 */
export function MoneyField({
  label,
  cents,
  onChangeCents,
  placeholder = '0.00',
}: {
  label: string;
  cents: number;
  onChangeCents: (cents: number) => void;
  placeholder?: string;
}) {
  const colors = useTheme();
  const [text, setText] = useState(() => centsToInput(cents));
  return (
    <View style={styles.field}>
      <FieldLabel text={label} />
      <View
        style={[
          styles.input,
          styles.moneyWrap,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[Type.body, { color: colors.textMuted, marginRight: 4 }]}>$</Text>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            onChangeCents(parseMoney(v) ?? 0);
          }}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          style={[Type.body, { color: colors.text, flex: 1, padding: 0 }]}
        />
      </View>
    </View>
  );
}

/** ISO date field with a lightweight masked text input (YYYY-MM-DD). */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const colors = useTheme();
  const valid = value === '' || isValidIso(value);
  return (
    <View style={styles.field}>
      <FieldLabel text={label} />
      <TextInput
        value={value}
        onChangeText={(v) => {
          // Auto-insert dashes while typing digits.
          const digits = v.replace(/[^\d]/g, '').slice(0, 8);
          let out = digits;
          if (digits.length > 6) out = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
          else if (digits.length > 4) out = `${digits.slice(0, 4)}-${digits.slice(4)}`;
          onChange(out);
        }}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        style={[
          styles.input,
          Type.body,
          {
            backgroundColor: colors.surface,
            borderColor: valid ? colors.border : colors.danger,
            color: colors.text,
          },
        ]}
      />
      {value !== '' && valid ? (
        <Text style={[Type.caption, { color: colors.textMuted, marginTop: 4 }]}>{formatIso(value)}</Text>
      ) : null}
    </View>
  );
}

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
}

/** Tap-to-open modal picker; works for enums and entity lists alike. */
export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  allowClear = false,
}: {
  label: string;
  value: T | null;
  options: SelectOption<T>[];
  onChange: (value: T | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={styles.field}>
      <FieldLabel text={label} />
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[Type.body, { color: selected ? colors.text : colors.textMuted }]}>
          {selected ? selected.label : placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <Text style={[Type.subheading, { color: colors.text, padding: Space.lg }]}>{label}</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {allowClear ? (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Text style={[Type.body, { color: colors.textMuted }]}>None</Text>
                </Pressable>
              ) : null}
              {options.map((option) => (
                <Pressable
                  key={String(option.value)}
                  style={[
                    styles.option,
                    option.value === value && { backgroundColor: colors.primarySoft },
                  ]}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      Type.body,
                      { color: option.value === value ? colors.primary : colors.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function FormRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.formRow}>{children}</View>;
}

const styles = StyleSheet.create({
  field: { marginBottom: Space.lg, flex: 1 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  moneyWrap: { flexDirection: 'row', alignItems: 'center' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: Space.xl,
  },
  sheet: { borderRadius: Radius.lg, overflow: 'hidden' },
  option: {
    paddingHorizontal: Space.lg,
    paddingVertical: 14,
  },
  formRow: { flexDirection: 'row', gap: Space.md },
});
