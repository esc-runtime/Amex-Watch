/**
 * First-run explainer, and the note someone gets when promoted to admin.
 *
 * Shown once per user, tracked on profiles rather than localStorage so it
 * follows them across devices. Dismissed only by the button — no backdrop or
 * escape close, because this is the one moment their attention is guaranteed.
 */

export default function Welcome({ variant = "user", onClose }) {
  if (variant === "admin") {
    return (
      <div className="wel-backdrop">
        <div
          className="wel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wel-title"
        >
          <h1 className="wel-title" id="wel-title">
            You&apos;re an admin now
          </h1>

          <p className="wel-lead">
            Which means a few extra things show up in your header. Here&apos;s
            what they do.
          </p>

          <div className="wel-section">
            <h2 className="wel-h">Keywords</h2>
            <p>
              You can now edit the keyword list directly — add one, remove one,
              and it takes effect on the next page refresh. No waiting, no
              deploy. Be a little careful: a broad word like
              &ldquo;management&rdquo; will pull in a lot of roles that
              aren&apos;t ours.
            </p>
          </div>

          <div className="wel-section">
            <h2 className="wel-h">Requests</h2>
            <p>
              When someone asks for a keyword to be added, it lands here with a
              red dot. Accept it and the word goes straight into the list.
              Reject it and nothing changes. Either way the ask is kept, so we
              can see what people keep asking for.
            </p>
          </div>

          <div className="wel-section">
            <h2 className="wel-h">Feedback</h2>
            <p>
              Whatever people write in gets collected here. Mark one read once
              you&apos;ve seen it and the count goes down.
            </p>
          </div>

          <div className="wel-section">
            <h2 className="wel-h">Audience</h2>
            <p>
              Everyone who has signed up, and when they last opened the app.
              Useful for knowing whether anyone is actually using this.
            </p>
          </div>

          <button className="aw-btn wel-ok" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wel-backdrop">
      <div
        className="wel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wel-title"
      >
        <h1 className="wel-title" id="wel-title">
          Welcome to AMEX<span>/</span>WATCH
        </h1>

        <p className="wel-lead">
          This watches American Express for ServiceNow roles in India, so you
          don&apos;t have to keep checking their careers page. When something
          opens, it shows up here — usually the same day it&apos;s posted.
        </p>

        <div className="wel-section">
          <h2 className="wel-h">It checks on its own</h2>
          <p>
            Four times a day, automatically. If you&apos;re impatient, Check
            jobs runs one right now — once an hour at most, so we&apos;re not
            pounding their servers.
          </p>
        </div>

        <div className="wel-section">
          <h2 className="wel-h">New roles are marked</h2>
          <p>
            Anything you haven&apos;t opened is tagged and sits at the top. Open
            it or mark it read and it drops down. So you only ever look at
            what&apos;s changed since last time.
          </p>
        </div>

        <div className="wel-section">
          <h2 className="wel-h">Not just job titles</h2>
          <p>
            It reads the full description, not only the title. A lot of
            ServiceNow work at Amex is posted under names like &ldquo;Analyst
            &ndash; Control Management&rdquo; — you&apos;d scroll straight past
            it. Open Rules to see every keyword being matched.
          </p>
        </div>

        <div className="wel-section">
          <h2 className="wel-h">Something missing?</h2>
          <p>
            If a keyword should be on that list, suggest it on the Rules page.
            And if anything about this is annoying or wrong, Feedback goes
            straight to whoever can fix it.
          </p>
        </div>

        <button className="aw-btn wel-ok" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
