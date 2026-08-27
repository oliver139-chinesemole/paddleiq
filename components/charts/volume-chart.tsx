"use client";

import dynamic from "next/dynamic";

/**
 * Weekly volume chart, loaded on demand.
 *
 * Recharts is around a third of a megabyte and was imported statically here,
 * which put the whole charting library in the dashboard's first load — every
 * athlete downloaded it before seeing a single number, on the screen they land
 * on straight after opening the app.
 *
 * The placeholder is the same height as the chart, so nothing on the page
 * moves when the real one arrives.
 */
const VolumeChartImpl = dynamic(() => import("./volume-chart-impl"), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[160px] w-full animate-pulse rounded-xl bg-[#111827]" />,
});

export function VolumeChart(props: { data: { week: string; distance: number }[] }) {
  return <VolumeChartImpl {...props} />;
}
