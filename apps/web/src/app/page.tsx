import { gitSha } from "../sha";

// Rendered at request time: the image gets its sha after the build, and a prerendered page would freeze it.
export const dynamic = "force-dynamic";

const NOTICE =
  "Educational use only. Not for construction, permitting, or professional engineering use. Results are not a substitute for analysis and design by a licensed engineer.";

export default function HomePage() {
  return (
    <main>
      <h1>Bridle</h1>
      <p data-testid="sha">{gitSha()}</p>
      <p data-testid="notice">{NOTICE}</p>
    </main>
  );
}
