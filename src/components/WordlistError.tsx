import "./WordlistError.css";

interface Props {
  message: string;
  onRetry: () => void;
}

export function WordlistError({ message, onRetry }: Props) {
  return (
    <div className="wordlist-error" role="alert">
      <div className="wordlist-error__panel">
        <h2>Could not load words</h2>
        <p>{message}</p>
        <button onClick={onRetry}>Retry</button>
      </div>
    </div>
  );
}
