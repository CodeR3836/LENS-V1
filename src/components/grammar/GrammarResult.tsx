import { useState, type FC } from "react";
import { diffText, type DiffSegment } from "../../utils/textDiff";

interface GrammarResultProps {
  original: string;
  corrected: string;
}

export const GrammarResult: FC<GrammarResultProps> = ({ original, corrected }) => {
  const segments = diffText(original, corrected);

  return (
    <div className="grammar-result">
      {segments.map((seg) => (
        <GrammarSegmentComponent key={seg.id} segment={seg} />
      ))}
    </div>
  );
};

const GrammarSegmentComponent: FC<{ segment: DiffSegment }> = ({ segment }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (segment.type === "equal") {
    return <span className="grammar-text--equal">{segment.value}</span>;
  }

  // Tooltip content helper
  const getTooltipContent = () => {
    switch (segment.type) {
      case "replaced":
        return (
          <div className="grammar-tooltip__content">
            <div className="grammar-tooltip__row">
              <span className="grammar-tooltip__label">Original:</span>
              <span className="grammar-tooltip__val grammar-tooltip__val--del">{segment.originalValue}</span>
            </div>
            <div className="grammar-tooltip__divider" />
            <div className="grammar-tooltip__row">
              <span className="grammar-tooltip__label">Changed to:</span>
              <span className="grammar-tooltip__val grammar-tooltip__val--ins">{segment.value}</span>
            </div>
          </div>
        );
      case "added":
        return (
          <div className="grammar-tooltip__content">
            <div className="grammar-tooltip__row">
              <span className="grammar-tooltip__label">Added:</span>
              <span className="grammar-tooltip__val grammar-tooltip__val--ins">{segment.value}</span>
            </div>
          </div>
        );
      case "removed":
        return (
          <div className="grammar-tooltip__content">
            <div className="grammar-tooltip__row">
              <span className="grammar-tooltip__label">Removed:</span>
              <span className="grammar-tooltip__val grammar-tooltip__val--del">{segment.originalValue}</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getClassName = () => {
    switch (segment.type) {
      case "replaced":
        return "grammar-text--replaced";
      case "added":
        return "grammar-text--added";
      case "removed":
        return "grammar-text--removed";
      default:
        return "";
    }
  };

  const displayValue = segment.type === "removed" ? segment.originalValue : segment.value;

  return (
    <span
      className={`grammar-segment ${getClassName()}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {displayValue}
      {isHovered && (
        <span className="grammar-tooltip" role="tooltip">
          {getTooltipContent()}
        </span>
      )}
    </span>
  );
};
