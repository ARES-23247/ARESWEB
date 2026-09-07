# Academy source refresh during CI rollout

The required remote provenance check for PR #266 detected an official release change while the PR was running. This refresh uses the standing maintenance approval in AGENTS.md. It changes source files and unapproved review digests only; it does not publish or migrate production documents.

- Previous official source: `0975b30e65f20998030eb091c8cd82142feb7fb9`, ARES 17.0.1 / Studio 7.0.2.
- New official source: [`8746da0123eec428872375ee2703750d96724170`](https://github.com/ARES-23247/ARES-Robotics/commit/8746da0123eec428872375ee2703750d96724170), ARES 17.0.2 / Studio 7.0.3; FTC/FRC starters 17.0.2.
- Source obtained from the official public repository in an isolated clone. No unrelated local monorepo edits were used.
- All 142 unique catalog source paths resolve at the new immutable commit. Nine referenced files changed: the release manifest, README, monorepo CI, PIDController, InputMath, PoseEstimator, VisionMahalanobisFilter, math/coordinate contracts, and FTC mecanum calibration.

The source review confirmed that the scalar deadband example remains unchanged; the InputMath change hardens vector input validation. The lessons now explain wrapped continuous-angle derivative measurements, rejection of vision frames older than the last accepted frame, non-finite measurement rejection, innovation validity even with statistical gating off, the revised FTC SysId sample columns, and scoped monorepo CI with required aggregate results. Classroom tracers retain their explicitly limited scope; no robot or physical-test evidence is invented.

Other reviewed changes improve history copying, sampled trajectory/wheel mathematics, and numerical innovation calculations without changing the narrow examples those lessons claim to model. Catalog source hashes, version text, curriculum provenance, and all three bounded review-candidate digests are refreshed together. Existing human-review requirements, batch membership, and historical screenshot identities are preserved. The candidate remains `review-candidate` with `requiresHumanReview: true`.
