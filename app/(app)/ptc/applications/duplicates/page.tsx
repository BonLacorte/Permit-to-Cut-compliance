import { DuplicateReviewPage } from "@/components/duplicates/page";
export default function Page({ searchParams }: { searchParams?: { number?: string } }) { return <DuplicateReviewPage group="PTC" number={searchParams?.number} />; }
