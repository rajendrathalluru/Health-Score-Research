import React from "react";
import type { FieldColor } from "./types";

interface Props {
  title: string;
  label: string;
  color: FieldColor;
  children: React.ReactNode;
  optional?: boolean;
  aside?: React.ReactNode;
}

const leftBorder: Record<FieldColor, string> = {
  green:  "border-l-green-500",
  amber:  "border-l-amber-500",
  red:    "border-l-red-500",
  blue:   "border-l-blue-500",
  purple: "border-l-purple-500",
};

export default function SectionCard({ title, label, color, children, optional, aside }: Props) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 border-l-4 ${leftBorder[color]} shadow-sm p-5`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {label}{optional && " · Optional"}
          </p>
        </div>
        {aside}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}