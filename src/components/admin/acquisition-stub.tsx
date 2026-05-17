// Placeholder card used by sub-pages of /admin/acquisition that
// don't have data hookups yet. Sits inside the .uni-hub-test shell
// provided by the section layout.

export function AcquisitionStub({
  step,
  title,
  description,
  comingSoon,
}: {
  step: string;
  title: string;
  description: string;
  comingSoon: string;
}) {
  return (
    <>
      <section className="aq-step-header">
        <h2 className="aq-step-title">
          <span className="aq-step-num-inline">{step}</span>
          {title}
        </h2>
        <p className="aq-step-sub">{description}</p>
      </section>

      <div className="uni-hub-empty aq-stub-card">
        <span className="aq-stub-pill">Coming soon</span>
        <p className="aq-stub-text">{comingSoon}</p>
      </div>
    </>
  );
}
