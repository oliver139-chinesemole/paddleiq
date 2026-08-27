"use client";

import dynamic from "next/dynamic";

/** Split-progress chart, loaded on demand. See volume-chart.tsx for why. */
const ProgressChartImpl = dynamic(() => import("./progress-chart-impl"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[140px] w-full animate-pulse rounded-xl bg-[#111827]" />,
});

export function ProgressChart(props: {
  data: { date: string; split: number }[];
  color?: string;
  label?: string;
  invertY?: boolean;
}) {
  return <ProgressChartImpl {...props} />;
}
