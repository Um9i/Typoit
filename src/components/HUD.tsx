import React from "react";
import { fmtMs } from "../utils";
import "./HUD.css";

const MAX_LIVES = 3;

interface HUDProps {
  lives: number;
  countdownMs: number;
  visible: boolean;
}

export function HUD({ lives, countdownMs, visible }: HUDProps) {
  if (!visible) return null;
  const urgent = countdownMs < 30000;
  return (
    <div className="hud">
      <div className={"countdown" + (urgent ? " urgent" : "")}>
        {fmtMs(countdownMs)}
      </div>
      <div className="hearts">
        {Array.from({ length: MAX_LIVES }, (_, i) => (
          <span key={i} className={i < lives ? "alive" : "dead"}>
            &#9829;
          </span>
        ))}
      </div>
    </div>
  );
}
