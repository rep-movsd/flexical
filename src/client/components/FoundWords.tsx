import { Component } from "preact";

export interface FoundWord {
  word: string;
  points: number;
}

/** Accepted words, grouped by length. */
export class FoundWords extends Component<{ words: FoundWord[] }> {
  render() {
    const groups = new Map<number, FoundWord[]>();
    for (const entry of [...this.props.words].sort((a, b) => a.word.localeCompare(b.word))) {
      const bucket = groups.get(entry.word.length) ?? [];
      bucket.push(entry);
      groups.set(entry.word.length, bucket);
    }
    const lengths = [...groups.keys()].sort((a, b) => a - b);

    return (
      <section class="panel found">
        <h2 class="panel__title">
          Found <span class="badge">{this.props.words.length}</span>
        </h2>
        {this.props.words.length === 0 ? (
          <p class="muted">No words yet. Find your first one above.</p>
        ) : (
          lengths.map((length) => (
            <div class="found__group" key={length}>
              <h3 class="found__len">{length} letters</h3>
              <ul class="chips">
                {groups.get(length)!.map((entry) => (
                  <li class="chip" key={entry.word}>
                    {entry.word}
                    <span class="chip__pts">+{entry.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    );
  }
}
