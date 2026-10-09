import { ScrollX } from "@/components/common/scroll-x";
import { seedList, type InferenceSection, type SeedRow } from "@/lib/inference/seeds";

const SECTION_LABEL: Record<InferenceSection, string> = {
  uncertainty: "Uncertainty",
  coverage: "Coverage",
  "choosing-k": "Choosing K",
  convergence: "Convergence",
};

/** Every seed and size behind the simulated numbers on /inference. */
export function SeedsTable({ rows }: { rows: SeedRow[] }) {
  return (
    <ScrollX label="Seeds and sizes" className="sheet p-1">
      <table className="w-full min-w-[44rem] text-sm">
        <caption className="sr-only">
          The random seed and the sizes behind each simulation on this page
        </caption>
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th scope="col" className="px-3 py-2.5 font-normal">
              what the seed drives
            </th>
            <th scope="col" className="px-2 py-2.5 font-normal">
              seed
            </th>
            <th scope="col" className="px-2 py-2.5 font-normal">
              sizes
            </th>
            <th scope="col" className="px-3 py-2.5 font-normal">
              shown in
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.study} className="border-t align-top">
              <th scope="row" className="px-3 py-2.5 text-left font-normal">
                {r.study}
              </th>
              <td className="num px-2 py-2.5 font-medium whitespace-nowrap">{seedList(r.seeds)}</td>
              <td className="num px-2 py-2.5 text-muted-foreground">{r.sizes}</td>
              <td className="px-3 py-2.5 whitespace-nowrap">
                <a className="link" href={`#${r.section}`}>
                  {SECTION_LABEL[r.section]}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollX>
  );
}
