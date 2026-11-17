// Failing fixture of lint-strings: seven hard-coded user-facing strings, one per rule (two for jsx-attribute).
export const metadata = {
  title: "Course settings",
};

const HEADING = "Gradebook";

export default function FailPage({ late }: { late: boolean }) {
  const status = late ? "Submitted after the deadline" : "ok";
  return (
    <main data-status={status}>
      <h1>{HEADING}</h1>
      <p>Welcome back</p>
      <p>{late ? "Late" : null}</p>
      <img src="/beam.png" alt="Beam diagram" />
      <input type="text" name="q" placeholder="Search" />
    </main>
  );
}
