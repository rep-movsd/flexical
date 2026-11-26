import { Component } from "preact";
import type { BadgeKind } from "../../shared/types";
import { BadgeIcon } from "./BadgeIcons";

export interface FoundWord {
  word: string;
  points: number;
  /** Badge marks earned by this specific word. */
  marks: BadgeKind[];
}

interface Props {
  words: FoundWord[];
  /** Highest word length to show a lane for (at least the longer seed). */
  maxLength: number;
  /** Lowest word length that scores. */
  minLength: number;
}

/** One lane per word length, each holding the words found at that length. */
export class FoundWords extends Component<Props> {
  render() {
    const { words, maxLength, minLength } = this.props;

    const byLength = new Map<number, FoundWord[]>();
    for (const entry of words) {
      const bucket = byLength.get(entry.word.length) ?? [];
      bucket.push(entry);
      byLength.set(entry.word.length, bucket);
    }
    for (const bucket of byLength.values()) {
      bucket.sort((a, b) => a.word.localeCompare(b.word));
    }

    const highest = Math.max(maxLength, ...words.map((w) => w.word.length));
    const lengths: number[] = [];
    for (let n = minLength; n <= highest; n++) lengths.push(n);

    return (
      <section class="panel found">
        <h2 class="panel__title">
          Found <span class="badge">{words.length}</span>
        </h2>
        <div class="found__lanes">
          {lengths.map((length) => {
            const bucket = byLength.get(length) ?? [];
            return (
              <div class="found__lane" key={length}>
                <span class="found__lane-len">{length}</span>
                <span class="found__lane-words">
                  {bucket.length === 0 ? (
                    <span class="muted">—</span>
                  ) : (
                    bucket.map((entry) => (
                      <span class="chip" key={entry.word}>
                        {entry.word}
                        {entry.marks.map((kind) => (
                          <BadgeIcon key={kind} kind={kind} />
                        ))}
                        <span class="chip__pts">+{entry.points}</span>
                      </span>
                    ))
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    );
  }
}
