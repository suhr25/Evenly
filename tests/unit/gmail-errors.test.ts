import { describe, expect, it } from "vitest";
import { describeGmailFailure } from "@/lib/integrations/gmail";

/** Mirrors the shape googleapis/gaxios actually throws. */
function gaxiosError(status: number, causeMessage: string) {
  return { status, cause: { message: causeMessage } };
}

describe("describeGmailFailure", () => {
  it("explains an unenabled Gmail API rather than a generic failure", () => {
    const result = describeGmailFailure(
      gaxiosError(
        403,
        "Gmail API has not been used in project 470374173040 before or it is disabled. Enable it by visiting ..."
      )
    );
    expect(result.status).toBe(400);
    expect(result.message).toMatch(/Gmail API isn't enabled/i);
  });

  it("points at reconnecting when the scope is missing", () => {
    const result = describeGmailFailure(gaxiosError(403, "Request had insufficient authentication scopes."));
    expect(result.status).toBe(400);
    expect(result.message).toMatch(/reconnect/i);
  });

  it("points at reconnecting when the grant was revoked", () => {
    const result = describeGmailFailure({ status: 400, cause: { message: "invalid_grant" } });
    expect(result.message).toMatch(/expired or was revoked/i);
  });

  it("surfaces rate limiting as a 429 the user can retry", () => {
    const result = describeGmailFailure(gaxiosError(429, "User-rate limit exceeded."));
    expect(result.status).toBe(429);
    expect(result.message).toMatch(/rate limit/i);
  });

  it("falls back to a generic upstream error for anything unrecognised", () => {
    const result = describeGmailFailure(new Error("socket hang up"));
    expect(result.status).toBe(502);
    expect(result.message).toMatch(/Couldn't reach Gmail/i);
  });
});
