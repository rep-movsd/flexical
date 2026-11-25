import { Component } from "preact";

/** Accepted words, grouped by length for easy scanning. */
export class FoundWords extends Component<{ words: string[] }> {
  render() {
    const groups = new Map<number, string[]>();
    for (const word of [...this.props.words].sort()) {
      const bucket = groups.get(word.length) ?? [];
      bucket.push(word);
      groups.set(word.length, bucket);
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
                {groups.get(length)!.map((word) => (
                  <li class="chip" key={word}>
                    {word}
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
