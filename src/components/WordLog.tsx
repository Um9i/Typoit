import React, { useRef, useEffect } from "react";
import type { LogEntry } from "../types";
import "./WordLog.css";

interface WordLogProps {
  log: LogEntry[];
}

export function WordLog({ log }: WordLogProps) {
  const wrapRef = useRef<HTMLTableElement>(null);
  useEffect(() => {
    if (wrapRef.current)
      wrapRef.current.parentElement!.scrollTop =
        wrapRef.current.parentElement!.scrollHeight;
  }, [log.length]);
  if (log.length === 0) return null;
  return (
    <table className="log-table" ref={wrapRef}>
      <thead>
        <tr>
          <th>#</th>
          <th>Word</th>
          <th>Time (s)</th>
        </tr>
      </thead>
      <tbody>
        {log.map((entry, i) => (
          <tr key={i}>
            <td>{i + 1}</td>
            <td>{entry.word}</td>
            <td>{entry.time.toFixed(3)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
