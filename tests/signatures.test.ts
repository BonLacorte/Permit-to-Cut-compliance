import { describe, expect, it } from "vitest";
import { normalizeSignatureStatus, ptcSignatureFinding, pttSignatureFinding } from "@/lib/signatures";
import { mergeRemarks, replaceGeneratedRemarks } from "@/lib/ptc-checks";

describe("signature findings", () => {
  it("treats missing signature status as Signed", () => {
    expect(normalizeSignatureStatus(null)).toBe("Signed");
    expect(ptcSignatureFinding({ recommendingApproval: "A", approved: "B" })).toBeNull();
  });

  it("generates PTC blank signature findings", () => {
    expect(ptcSignatureFinding({ recommendingApprovalSignatureStatus: "Blank" })).toBe("There's no signature in Recommending Approval field.");
  });

  it("generates PTC For findings with typed name", () => {
    expect(ptcSignatureFinding({ approvedSignatureStatus: "For", approvedSignatureForName: "Maria Santos", recommendingApproval: "Juan Dela Cruz" })).toBe("The signature in Approved field was signed ‘For’ by Maria Santos on behalf of the authorized signatory.");
  });

  it("uses counterpart fallback when For name is blank", () => {
    expect(ptcSignatureFinding({ recommendingApprovalSignatureStatus: "For", recommendingApprovalSignatureForName: "", approved: "Approver Name" })).toBe("The signature in Recommending Approval field was signed ‘For’ by Approver Name on behalf of the authorized signatory.");
  });

  it("generates PTT signature findings", () => {
    expect(pttSignatureFinding({ validatedInspectedBySignatureStatus: "Blank", issuedBySignatureStatus: "For", validatedInspectedBy: "Inspector", issuedBy: "Issuer" })).toBe([
      "There's no signature in Validated/Inspected By field.",
      "The signature in Issued By field was signed ‘For’ by Inspector on behalf of the authorized signatory."
    ].join("\n"));
  });

  it("uses PTT counterpart fallback when the For name is blank", () => {
    expect(pttSignatureFinding({ validatedInspectedBySignatureStatus: "For", issuedBy: "Issuing Officer" })).toBe("The signature in Validated/Inspected By field was signed ‘For’ by Issuing Officer on behalf of the authorized signatory.");
  });

  it("deduplicates generated findings in saved remarks", () => {
    const signatureFinding = "There's no signature in Approved field.";
    expect(mergeRemarks("Manual note\n\n" + signatureFinding, [signatureFinding, "Fee differs."])).toBe("Manual note\n\nThere's no signature in Approved field.\n\nFee differs.");
  });

  it("replaces prior generated findings while retaining manual remarks", () => {
    const oldSignatureFinding = "The signature in Approved field was signed 'For' by Old Delegate on behalf of the authorized signatory.";
    const newSignatureFinding = "There's no signature in Approved field.";
    expect(replaceGeneratedRemarks("Manual note\n\n" + oldSignatureFinding, [oldSignatureFinding], [newSignatureFinding])).toBe("Manual note\n\nThere's no signature in Approved field.");
  });
});
