

export interface DiffSegment {
  id: string;
  type: "equal" | "added" | "removed" | "replaced";
  value: string;         
  originalValue?: string; 
}


function tokenize(text: string): string[] {
  return text.split(/([^\w']+|\s+)/).filter(Boolean);
}

interface RawToken {
  type: "added" | "removed" | "equal";
  value: string;
}


function diffTokens(A: string[], B: string[]): RawToken[] {
  const N = A.length;
  const M = B.length;

  if (N === 0) {
    return B.map(val => ({ type: "added", value: val }));
  }
  if (M === 0) {
    return A.map(val => ({ type: "removed", value: val }));
  }

  if (N * M > 25000000) {
    return [
      { type: "removed", value: A.join("") },
      { type: "added", value: B.join("") }
    ];
  }

  const dp: Int32Array[] = Array.from({ length: N + 1 }, () => new Int32Array(M + 1));
  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      if (A[i - 1] === B[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = N;
  let j = M;
  const diff: RawToken[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && A[i - 1] === B[j - 1]) {
      diff.unshift({ type: "equal", value: A[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: "added", value: B[j - 1] });
      j--;
    } else {
      diff.unshift({ type: "removed", value: A[i - 1] });
      i--;
    }
  }

  return diff;
}

let segmentIdCounter = 0;
function nextSegId(): string {
  segmentIdCounter++;
  return `seg-${segmentIdCounter}-${Math.random().toString(36).substring(2, 7)}`;
}


function createSegments(
  type: "added" | "removed" | "replaced",
  original: string,
  corrected: string
): DiffSegment[] {
  const result: DiffSegment[] = [];

  if (type === "replaced") {
    let orig = original;
    let corr = corrected;

    let leading = "";
    while (orig.length > 0 && corr.length > 0 && orig[0] === corr[0] && /\s/.test(orig[0])) {
      leading += orig[0];
      orig = orig.substring(1);
      corr = corr.substring(1);
    }
    if (leading) {
      result.push({ id: nextSegId(), type: "equal", value: leading });
    }

    let trailing = "";
    while (
      orig.length > 0 &&
      corr.length > 0 &&
      orig[orig.length - 1] === corr[corr.length - 1] &&
      /\s/.test(orig[orig.length - 1])
    ) {
      trailing = orig[orig.length - 1] + trailing;
      orig = orig.substring(0, orig.length - 1);
      corr = corr.substring(0, corr.length - 1);
    }

    if (orig || corr) {
      result.push({
        id: nextSegId(),
        type: "replaced",
        value: corr,
        originalValue: orig
      });
    }

    if (trailing) {
      result.push({ id: nextSegId(), type: "equal", value: trailing });
    }
  } else if (type === "added") {

    const matchLead = corrected.match(/^(\s+)/);
    const matchTrail = corrected.match(/(\s+)$/);

    const lead = matchLead ? matchLead[0] : "";
    const trail = matchTrail ? matchTrail[0] : "";
    const core = corrected.substring(lead.length, corrected.length - trail.length);

    if (lead) {
      result.push({ id: nextSegId(), type: "equal", value: lead });
    }
    if (core) {
      result.push({ id: nextSegId(), type: "added", value: core });
    }
    if (trail) {
      result.push({ id: nextSegId(), type: "equal", value: trail });
    }
  } else {

    const matchLead = original.match(/^(\s+)/);
    const matchTrail = original.match(/(\s+)$/);

    const lead = matchLead ? matchLead[0] : "";
    const trail = matchTrail ? matchTrail[0] : "";
    const core = original.substring(lead.length, original.length - trail.length);

    if (lead) {
      result.push({ id: nextSegId(), type: "equal", value: lead });
    }
    if (core) {
      result.push({
        id: nextSegId(),
        type: "removed",
        value: "", 
        originalValue: core
      });
    }
    if (trail) {
      result.push({ id: nextSegId(), type: "equal", value: trail });
    }
  }

  return result;
}

function groupTokens(tokens: RawToken[]): DiffSegment[] {
  const segments: DiffSegment[] = [];
  let removedBuf: string[] = [];
  let addedBuf: string[] = [];

  const flushEdits = () => {
    if (removedBuf.length > 0 && addedBuf.length > 0) {
      const orig = removedBuf.join("");
      const corr = addedBuf.join("");
      segments.push(...createSegments("replaced", orig, corr));
    } else if (removedBuf.length > 0) {
      segments.push(...createSegments("removed", removedBuf.join(""), ""));
    } else if (addedBuf.length > 0) {
      segments.push(...createSegments("added", "", addedBuf.join("")));
    }
    removedBuf = [];
    addedBuf = [];
  };

  for (const token of tokens) {
    if (token.type === "equal") {
      flushEdits();

      const last = segments[segments.length - 1];
      if (last && last.type === "equal") {
        last.value += token.value;
      } else {
        segments.push({ id: nextSegId(), type: "equal", value: token.value });
      }
    } else if (token.type === "removed") {
      removedBuf.push(token.value);
    } else {
      addedBuf.push(token.value);
    }
  }

  flushEdits();
  return segments;
}


export function diffText(original: string, corrected: string): DiffSegment[] {
  if (original === corrected) {
    return [{ id: nextSegId(), type: "equal", value: corrected }];
  }

  const origParas = original.split("\n");
  const corrParas = corrected.split("\n");

  if (origParas.length === corrParas.length) {
    const allSegments: DiffSegment[] = [];
    for (let p = 0; p < origParas.length; p++) {
      if (p > 0) {
        allSegments.push({ id: nextSegId(), type: "equal", value: "\n" });
      }
      const A = tokenize(origParas[p]);
      const B = tokenize(corrParas[p]);
      const raw = diffTokens(A, B);
      allSegments.push(...groupTokens(raw));
    }
    return allSegments;
  }

  const A = tokenize(original);
  const B = tokenize(corrected);
  const raw = diffTokens(A, B);
  return groupTokens(raw);
}
