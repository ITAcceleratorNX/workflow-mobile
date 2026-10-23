import { useEffect, useState } from "react";
import { todayTaskDateKey } from "@/lib/dateTimeUtils";
import { millisecondsUntilNextTaskDay } from "@/lib/task-day-clock";
import { AppState } from "react-native";

export function useCurrentTaskDay(): string {
  const [dayKey, setDayKey] = useState(todayTaskDateKey);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const synchronize = () => {
      clearTimeout(timer);
      setDayKey(todayTaskDateKey());
      timer = setTimeout(synchronize, millisecondsUntilNextTaskDay(new Date()));
    };
    synchronize();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") synchronize();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
  return dayKey;
}
