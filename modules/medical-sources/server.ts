import { defineServerModule } from "@aihot/backend/modules";
import { sql } from "@aihot/backend/db";
import { MEDICAL_SOURCES } from "@aihot/industry/medical-sources";
import { collectMedicalSource } from "./collector.ts";

export default defineServerModule({
  name: "medical-sources",
  sourceKinds: {
    external: { fetchNow: async source => collectMedicalSource(source.id, { force: true }) },
  },
  schedules: [{
    name: "medical-sources.collect", cron: "* * * * *", missed: "skip", when: () => process.env.COLLECT_ENABLED === "true",
    run: async () => {
      const [due] = await sql<{ id: string }[]>`SELECT id FROM sources WHERE enabled AND id=ANY(${MEDICAL_SOURCES.filter(s => !s.unavailable).map(s => s.id)})
        AND (next_fetch_at IS NULL OR next_fetch_at<=now()) ORDER BY next_fetch_at NULLS FIRST LIMIT 1`;
      return due ? collectMedicalSource(due.id) : { status: "idle" };
    },
  }],
});
