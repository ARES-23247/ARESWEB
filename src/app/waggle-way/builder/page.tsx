import { Link, useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import Builder from "@ares/waggle-way/builder";
import { Button } from "@ares/ui/button";
import { useAuth } from "@/context/AuthContext";
import { waggleCommunity } from "@/lib/waggleCommunity";
export default function WaggleWayBuilderPage() {
  const [params, setParams] = useSearchParams();
  const { user, authorizedUser, loading, loginWithGoogle, authError } =
    useAuth();
  const canSubmit = Boolean(
    user &&
    authorizedUser &&
    ["admin", "coach", "mentor", "member"].includes(authorizedUser.role),
  );
  return (
    <>
      <SEO
        title="Waggle Way · Garden workshop"
        description="Build bee puzzles with guides, fans, water, shelter leaves and a player tool supply."
        noindex
      />
      <Builder
        remix={
          params.has("remix")
            ? {
                source: {
                  id: params.get("remix") ?? "",
                  revision: params.get("revision") ?? "",
                },
                onClose: () =>
                  setParams(
                    (previous) => {
                      const next = new URLSearchParams(previous);
                      next.delete("remix");
                      next.delete("revision");
                      return next;
                    },
                    { replace: true },
                  ),
              }
            : undefined
        }
        playLink={<Link to="/waggle-way">Back to play →</Link>}
        community={{
          client: waggleCommunity,
          accountKey: user?.uid ?? "guest",
          canSubmit,
          canReview: Boolean(
            user &&
            authorizedUser &&
            ["admin", "coach"].includes(authorizedUser.role),
          ),
          identityControl: (
            <>
              {!user && (
                <Button
                  disabled={loading}
                  onClick={() => void loginWithGoogle()}
                >
                  {loading ? "Checking sign-in…" : "Sign in to submit"}
                </Button>
              )}
              {user && !canSubmit && (
                <p>
                  This account does not currently have team submission access.
                </p>
              )}
              {authError && <p role="alert">{authError}</p>}
            </>
          ),
        }}
      />
    </>
  );
}
