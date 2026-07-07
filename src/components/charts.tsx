import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { formatCents } from '@/lib/money';
import { ChartColors, Radius, Space, Type, useTheme } from './theme';

export interface DonutSlice {
  label: string;
  valueCents: number;
}

/**
 * Donut chart with legend, built from SVG circle stroke segments.
 * Used for cost/expense category breakdowns.
 */
export function DonutChart({ slices, centerLabel }: { slices: DonutSlice[]; centerLabel?: string }) {
  const colors = useTheme();
  const total = slices.reduce((sum, s) => sum + s.valueCents, 0);
  if (total <= 0) return null;

  const size = 148;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = slices.map((slice, i) => {
    const fraction = slice.valueCents / total;
    const length = fraction * circumference;
    const seg = (
      <Circle
        key={slice.label}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={ChartColors[i % ChartColors.length]}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${length} ${circumference - length}`}
        strokeDashoffset={-offset}
      />
    );
    offset += length;
    return seg;
  });

  return (
    <View style={styles.donutWrap}>
      <View>
        <Svg width={size} height={size}>
          <G rotation={-90} originX={size / 2} originY={size / 2}>
            {segments}
          </G>
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <Text style={[Type.label, { color: colors.textMuted }]}>{centerLabel ?? 'Total'}</Text>
          <Text style={[Type.subheading, { color: colors.text }]}>
            {formatCents(total, { compact: true })}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, marginLeft: Space.lg }}>
        {slices.map((slice, i) => (
          <View key={slice.label} style={styles.legendRow}>
            <View
              style={[styles.legendDot, { backgroundColor: ChartColors[i % ChartColors.length] }]}
            />
            <Text style={[Type.caption, { color: colors.textSecondary, flex: 1 }]} numberOfLines={1}>
              {slice.label}
            </Text>
            <Text style={[Type.caption, { color: colors.text, fontWeight: '600' }]}>
              {formatCents(slice.valueCents, { compact: true })}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Budget utilization bar: green under budget, amber near, red over. */
export function BudgetBar({
  spentCents,
  budgetCents,
  compactLabels = false,
}: {
  spentCents: number;
  budgetCents: number;
  compactLabels?: boolean;
}) {
  const colors = useTheme();
  const hasBudget = budgetCents > 0;
  const ratio = hasBudget ? spentCents / budgetCents : 0;
  const fill = hasBudget ? Math.min(1, ratio) : 0;
  const barColor = !hasBudget
    ? colors.textMuted
    : ratio > 1
      ? colors.danger
      : ratio > 0.85
        ? colors.warning
        : colors.primary;

  return (
    <View>
      <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
        <View
          style={[styles.barFill, { backgroundColor: barColor, width: `${Math.round(fill * 100)}%` }]}
        />
      </View>
      <View style={styles.barLabels}>
        <Text style={[Type.caption, { color: colors.textSecondary }]}>
          {formatCents(spentCents, { compact: compactLabels })} spent
        </Text>
        <Text style={[Type.caption, { color: hasBudget && ratio > 1 ? colors.danger : colors.textMuted }]}>
          {hasBudget
            ? ratio > 1
              ? `${formatCents(spentCents - budgetCents, { compact: compactLabels })} over budget`
              : `${formatCents(budgetCents - spentCents, { compact: compactLabels })} left of ${formatCents(budgetCents, { compact: true })}`
            : 'No budget set'}
        </Text>
      </View>
    </View>
  );
}

/** Small stat tile for dashboard rows. */
export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.statTile,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text style={[Type.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[Type.stat, { color: colors.text, marginTop: 4 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 2 }]}>{sub}</Text> : null}
    </View>
  );
}

/** Simple vertical bar chart for monthly spend. */
export function BarChart({ data }: { data: { label: string; valueCents: number }[] }) {
  const colors = useTheme();
  const max = Math.max(...data.map((d) => d.valueCents), 1);
  return (
    <View style={styles.barChart}>
      {data.map((d) => (
        <View key={d.label} style={styles.barCol}>
          <Text style={[Type.caption, { color: colors.textMuted, fontSize: 10 }]} numberOfLines={1}>
            {formatCents(d.valueCents, { compact: true })}
          </Text>
          <View style={styles.barColTrack}>
            <View
              style={{
                backgroundColor: colors.primary,
                borderRadius: 4,
                width: '100%',
                height: `${Math.max(3, Math.round((d.valueCents / max) * 100))}%`,
              }}
            />
          </View>
          <Text style={[Type.caption, { color: colors.textMuted, fontSize: 10 }]}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  donutWrap: { flexDirection: 'row', alignItems: 'center' },
  donutCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  barTrack: { height: 10, borderRadius: Radius.full, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.full },
  barLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  statTile: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Space.lg,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Space.sm,
    height: 140,
  },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 4 },
  barColTrack: { flex: 1, width: '55%', justifyContent: 'flex-end' },
});
