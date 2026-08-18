import { PtcFeeCalculator } from "@/components/ptc-fee-calculator";
import { requireUser } from "@/lib/auth";

export default async function PtcFeesCalculatorPage() {
  await requireUser();

  return <div className="grid">
    <div>
      <h1>RA 8048 Fees Calculator</h1>
      <p className="muted">Calculate a PTC fee using the current RA 8048 baseline. Results are a review aid only and are not saved to an application record.</p>
    </div>
    <PtcFeeCalculator />
  </div>;
}
