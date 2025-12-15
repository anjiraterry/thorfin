// src/components/ui/progress.tsx
"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/src/lib/utils"

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  indicatorColor?: "blue" | "purple" | "indigo" | "green" | "red"
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, indicatorColor = "blue", ...props }, ref) => {
  // Define color classes for the indicator
  const indicatorColorClasses = {
    blue: "bg-blue-500",
    purple: "bg-purple-500",
    indigo: "bg-indigo-500",
    green: "bg-green-500",
    red: "bg-red-500",
  }

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800/60",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full w-full flex-1 transition-all",
          indicatorColorClasses[indicatorColor]
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }