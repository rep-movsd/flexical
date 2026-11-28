import { Component } from "preact";
import type { AnswerCount, BadgeKind } from "../../shared/types";
import { Icon, type IconName } from "./icons";
import { BadgeIcon } from "./BadgeIcons";
import { click, isSoundOn, setSoundOn } from "../sound";

export interface FoundWord {
  word: string;
  points: number;
  /** Badge marks earned by this specific word. */
  marks: BadgeKind[];
}

export type FoundView = "words" | "stats" | "help" | "settings";

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
  /** Which body to show (controlled by the parent). */
  view: FoundView;
  onView: (view: FoundView) => void;
}

/**
 * Found-words panel. The header shows total points and progress ("Found M/N",
 * N = every possible answer). Four icon buttons switch the body between a
 * wrapping word list, per-length progress bars, the game explanation, and
 * settings.
 */
export class FoundWords extends Component<Props, { soundOn: boolean }> {
  /** The scrolling word log, so we can keep the newest chip in view. */
  private logEl: HTMLDivElement | null = null;

  state = { soundOn: isSoundOn() };

  componentDidMount(): void {
    this.scrollLogToBottom();
  }

  componentDidUpdate(prev: Props): void {
    if (prev.words !== this.props.words || prev.view !== this.props.view) {
      this.scrollLogToBottom();
    }
  }

  /** Keep the newest chip visible when the log overflows. */
  private scrollLogToBottom(): void {
    const el = this.logEl;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private setLogRef = (el: HTMLDivElement | null): void => {
    this.logEl = el;
  };

  /** Total possible answers across every length. */
  private total(): number {
    return this.props.counts.reduce((sum, entry) => sum + entry.count, 0);
  }

  private viewButton(view: FoundView, title: string, icon: IconName) {
    const active = this.props.view === view;
    return (
      <button
        type="button"
        class={active ? "iconbtn iconbtn--active" : "iconbtn"}
        aria-pressed={active}
        title={title}
        onClick={() => this.props.onView(view)}
      >
        <Icon name={icon} size={18} />
      </button>
    );
  }

  render() {
    const { words, score, view } = this.props;

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
            {this.viewButton("words", "Words found, in order", "words")}
            {this.viewButton("stats", "Remaining by word length", "stats")}
            {this.viewButton("help", "How to play", "help")}
            {this.viewButton("settings", "Settings", "settings")}
          </div>
        </div>

        {view === "words"
          ? this.renderWords()
          : view === "stats"
            ? this.renderStats()
            : view === "help"
              ? this.renderHelp()
              : this.renderSettings()}
      </section>
    );
  }

  /** View A: every word found, in the order it was typed, as chips. */
  private renderWords() {
    const { words } = this.props;
    if (words.length === 0) {
      return <p class="muted">No words yet.</p>;
    }
    return (
      <div class="found__log" ref={this.setLogRef}>
        {words.map((entry) => (
          <span class="found__word" key={entry.word}>
            {entry.word}
          </span>
        ))}
      </div>
    );
  }

  /** View B: one progress bar per word length (found / total). */
  private renderStats() {
    const { words, maxLength, minLength, counts } = this.props;

    const totals = new Map<number, number>();
    for (const entry of counts) totals.set(entry.length, entry.count);

    const found = new Map<number, number>();
    for (const entry of words) {
      found.set(entry.word.length, (found.get(entry.word.length) ?? 0) + 1);
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
          const have = found.get(length) ?? 0;
          const total = totals.get(length);
          const pct = total ? Math.round((have / total) * 100) : 0;
          return (
            <div class="found__lane" key={length}>
              <span class="found__lane-len">{length}</span>
              <span class="found__lane-bar">
                <span class="found__lane-fill" style={{ width: `${pct}%` }} />
              </span>
              {total !== undefined && (
                <span class="found__lane-count" title={`${have} of ${total} found`}>
                  {have}/{total}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  /** View C: how to play. */
  private renderHelp() {
    return (
      <div class="help">
        <p>Find as many words as you can from the letters above.</p>
        <ul>
          <li>
            Words must be <strong>4+ letters</strong> and use <strong>only the letters shown</strong>.
            You can reuse a letter as often as you like.
          </li>
          <li>
            Longer words score exponentially more. The dictionary is custom, so{" "}
            <strong>inflected words</strong> (e.g. “fewer”, “stones”) are not valid.
          </li>
          <li>
            <BadgeIcon kind="sun" /> you found the hidden seed word.
          </li>
          <li>
            <BadgeIcon kind="star" /> a non-seed word at least as long as the seed.
          </li>
          <li>
            <strong>Today's game</strong> gives you one <strong>3-minute timed attempt</strong> — your{" "}
            <strong>hare</strong> score. The letters stay hidden until you press{" "}
            <strong>Start</strong>; the timer begins then.
          </li>
          <li>
            After the timer runs out — or on any past day — keep playing for your{" "}
            <strong>tortoise</strong> total. It has no time limit and never expires.
          </li>
          <li>
            <strong>Keys:</strong> <kbd>Space</kbd> shuffles the letters.
          </li>
          <li>A new game arrives every day at midnight IST.</li>
          <li>Your words save automatically, so you can come back and keep going.</li>
          <li>
            Peeking at someone's answers locks that game for you, so only peek when you're done.
          </li>
          <li>
            Replay past days from the <a href="/archive">Archive</a>.
          </li>
        </ul>
      </div>
    );
  }

  /** View D: settings. */
  private renderSettings() {
    const { soundOn } = this.state;
    return (
      <div class="settings">
        <label class="setting">
          <input
            type="checkbox"
            checked={soundOn}
            onChange={(event) => {
              const on = (event.target as HTMLInputElement).checked;
              setSoundOn(on);
              this.setState({ soundOn: on });
              if (on) click(0); // audible confirmation
            }}
          />
          <span>Sound effects</span>
        </label>
      </div>
    );
  }
}
