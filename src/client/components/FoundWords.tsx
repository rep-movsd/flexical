import { Component } from "preact";
import type { AnswerCount, BadgeKind } from "../../shared/types";
import { BadgeIcon } from "./BadgeIcons";
import { Icon } from "./icons";

export interface FoundWord {
  word: string;
  points: number;
  /** Badge marks earned by this specific word. */
  marks: BadgeKind[];
}

interface Props {
  words: FoundWord[];
  /** Running total of points for the words found so far. */
  score: number;
  /** Highest word length to show a lane for (at least the longer seed). */
  maxLength: number;
  /** Lowest word length that scores. */
  minLength: number;
  /** Precomputed number of possible answers per length. */
  counts: AnswerCount[];
}

type View = "words" | "counts";

interface State {
  view: View;
}

/**
 * Found-words panel. The header shows total points and progress
 * ("Found M/N", N = every possible answer). Two icon buttons switch the body
 * between a chronological word log and per-length answer counts.
 */
export class FoundWords extends Component<Props, State> {
  state: State = { view: "words" };

  /** Total possible answers across every length. */
  private total(): number {
    return this.props.counts.reduce((sum, entry) => sum + entry.count, 0);
  }

  private setView = (view: View): void => {
    this.setState({ view });
  };

  render() {
    const { words, score } = this.props;
    const { view } = this.state;

    return (
      <section class="panel found">
        <div class="found__head">
          <p class="found__stats">
            <strong class="found__points">{score}</strong> points
            <span class="muted">
              {" "}
              · Found {words.length}/{this.total()}
            </span>
          </p>
          <div class="found__views" role="group" aria-label="Found words view">
            <button
              type="button"
              class={view === "words" ? "iconbtn iconbtn--active" : "iconbtn"}
              aria-pressed={view === "words"}
              title="Words found, newest first"
              onClick={() => this.setView("words")}
            >
              <Icon name="words" size={18} />
            </button>
            <button
              type="button"
              class={view === "counts" ? "iconbtn iconbtn--active" : "iconbtn"}
              aria-pressed={view === "counts"}
              title="Remaining by word length"
              onClick={() => this.setView("counts")}
            >
              <Icon name="stats" size={18} />
            </button>
          </div>
        </div>

        {view === "words" ? this.renderWords() : this.renderCounts()}
      </section>
    );
  }

  /** View A: every word found, newest first, in plain default flow. */
  private renderWords() {
    const { words } = this.props;
    if (words.length === 0) {
      return <p class="muted">No words yet.</p>;
    }
    return (
      <div class="found__log">
        {words
          .slice()
          .reverse()
          .map((entry, index) => (
            <div class="found__log-word" key={`${entry.word}-${index}`}>
              {entry.word}
            </div>
          ))}
      </div>
    );
  }

  /** View B: one lane per word length, each counting found / total. */
  private renderCounts() {
    const { words, maxLength, minLength, counts } = this.props;

    const totals = new Map<number, number>();
    for (const entry of counts) totals.set(entry.length, entry.count);

    const byLength = new Map<number, FoundWord[]>();
    for (const entry of words) {
      const bucket = byLength.get(entry.word.length) ?? [];
      bucket.push(entry);
      byLength.set(entry.word.length, bucket);
    }
    for (const bucket of byLength.values()) {
      bucket.sort((a, b) => a.word.localeCompare(b.word));
    }

    const highest = Math.max(
      maxLength,
      ...counts.map((c) => c.length),
      ...words.map((w) => w.word.length),
    );
    const lengths: number[] = [];
    for (let n = minLength; n <= highest; n++) lengths.push(n);

    return (
      <div class="found__lanes">
        {lengths.map((length) => {
          const bucket = byLength.get(length) ?? [];
          const total = totals.get(length);
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
              {total !== undefined && (
                <span class="found__lane-count" title={`${bucket.length} of ${total} found`}>
                  {bucket.length}/{total}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }
}
