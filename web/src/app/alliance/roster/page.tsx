import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { getAllianceRoster, getAllianceTagsAndTactics } from "@/app/actions/alliance-roster";
import { AllianceRosterMatrix } from "./client-page";
import { Metadata } from "next";
import logger from "@/lib/logger";

export const metadata: Metadata = {
  title: "Alliance Roster Overview - CereBro",
  description: "View and filter your alliance's champion roster.",
};

export default async function AllianceRosterPage() {
    const player = await getUserPlayerWithAlliance();
    
    if (!player || !player.allianceId) {
        redirect("/");
    }

    logger.info({ userId: player.id, allianceId: player.allianceId }, "User accessing Alliance Roster Overview page");

    // Parallel fetch for data
    const [rosterData, metaData] = await Promise.all([
        getAllianceRoster(player.allianceId),
        getAllianceTagsAndTactics(player.allianceId)
    ]);

    return (
        <AllianceRosterMatrix 
            data={rosterData}
            initialTactics={metaData.tactics}
            initialTags={metaData.tags}
            season={metaData.season}
        />
    );
}
