import type { ComponentType } from "react";
import * as Recharts from "recharts";

const asComponent = (component: unknown) => component as ComponentType<any>;

export const AreaChart = asComponent(Recharts.AreaChart);
export const Area = asComponent(Recharts.Area);
export const BarChart = asComponent(Recharts.BarChart);
export const Bar = asComponent(Recharts.Bar);
export const XAxis = asComponent(Recharts.XAxis);
export const YAxis = asComponent(Recharts.YAxis);
export const CartesianGrid = asComponent(Recharts.CartesianGrid);
export const Tooltip = asComponent(Recharts.Tooltip);
export const ResponsiveContainer = asComponent(Recharts.ResponsiveContainer);
export const PieChart = asComponent(Recharts.PieChart);
export const Pie = asComponent(Recharts.Pie);
export const Cell = asComponent(Recharts.Cell);
export const LineChart = asComponent(Recharts.LineChart);
export const Line = asComponent(Recharts.Line);
export const FunnelChart = asComponent(Recharts.FunnelChart);
export const Funnel = asComponent(Recharts.Funnel);
export const LabelList = asComponent(Recharts.LabelList);
