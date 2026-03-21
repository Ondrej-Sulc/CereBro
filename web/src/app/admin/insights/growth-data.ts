import { prisma } from "@/lib/prisma"
import { startOfDay, subDays, eachDayOfInterval, format } from "date-fns"

export async function getGrowthData(days: number = 30) {
  const validatedDays = (Number.isInteger(days) && days >= 1) ? days : 30;
  const startDate = startOfDay(subDays(new Date(), validatedDays))

  const [
      players, 
      alliances, 
      botUsers,
      rosterEntries,
      donations,
      totalPlayersBefore,
      totalAlliancesBefore,
      totalBotUsersBefore,
      totalRosterBefore,
      totalDonationsBefore
  ] = await Promise.all([
    prisma.$queryRaw<{ date: Date, count: number }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*)::int as count
      FROM "Player"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
    `,
    prisma.$queryRaw<{ date: Date, count: number }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*)::int as count
      FROM "Alliance"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
    `,
    prisma.$queryRaw<{ date: Date, count: number }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*)::int as count
      FROM "BotUser"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
    `,
    prisma.$queryRaw<{ date: Date, count: number }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*)::int as count
      FROM "Roster"
      WHERE "createdAt" >= ${startDate}
      GROUP BY DATE_TRUNC('day', "createdAt")
    `,
    prisma.$queryRaw<{ date: Date, amount: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COALESCE(SUM("amountMinor"), 0)::bigint as amount
      FROM "SupportDonation"
      WHERE "createdAt" >= ${startDate} AND "status" = 'succeeded'
      GROUP BY DATE_TRUNC('day', "createdAt")
    `,
    prisma.player.count({ where: { createdAt: { lt: startDate } } }),
    prisma.alliance.count({ where: { createdAt: { lt: startDate } } }),
    prisma.botUser.count({ where: { createdAt: { lt: startDate } } }),
    prisma.roster.count({ where: { createdAt: { lt: startDate } } }),
    prisma.supportDonation.aggregate({
        where: { createdAt: { lt: startDate }, status: 'succeeded' },
        _sum: { amountMinor: true }
    }).then(res => Number(res._sum.amountMinor || 0))
  ])

  const interval = eachDayOfInterval({
    start: startDate,
    end: new Date()
  })

  // Pre-calculate Maps for O(1) lookups
  const playersMap = new Map(players.map(r => [format(new Date(r.date), 'yyyy-MM-dd'), r.count]))
  const alliancesMap = new Map(alliances.map(r => [format(new Date(r.date), 'yyyy-MM-dd'), r.count]))
  const botUsersMap = new Map(botUsers.map(r => [format(new Date(r.date), 'yyyy-MM-dd'), r.count]))
  const rosterMap = new Map(rosterEntries.map(r => [format(new Date(r.date), 'yyyy-MM-dd'), r.count]))
  const donationsMap = new Map(donations.map(r => [format(new Date(r.date), 'yyyy-MM-dd'), Number(r.amount)]))

  let runningPlayers = totalPlayersBefore
  let runningAlliances = totalAlliancesBefore
  let runningBotUsers = totalBotUsersBefore
  let runningRoster = totalRosterBefore
  let runningDonations = totalDonationsBefore

  return interval.map(date => {
    const dateStr = format(date, 'yyyy-MM-dd')
    
    const dayPlayers = playersMap.get(dateStr) || 0
    const dayAlliances = alliancesMap.get(dateStr) || 0
    const dayBotUsers = botUsersMap.get(dateStr) || 0
    const dayRoster = rosterMap.get(dateStr) || 0
    const dayDonations = donationsMap.get(dateStr) || 0

    runningPlayers += dayPlayers
    runningAlliances += dayAlliances
    runningBotUsers += dayBotUsers
    runningRoster += dayRoster
    runningDonations += dayDonations

    return {
      date: dateStr,
      newPlayers: dayPlayers,
      totalPlayers: runningPlayers,
      newAlliances: dayAlliances,
      totalAlliances: runningAlliances,
      newBotUsers: dayBotUsers,
      totalBotUsers: runningBotUsers,
      newRoster: dayRoster,
      totalRoster: runningRoster,
      newDonations: dayDonations / 100, // Assuming minor units (cents)
      totalDonations: runningDonations / 100
    }
  })
}

export async function getRosterDistribution() {
    // Combined distribution by Stars and Rank
    const distribution = await prisma.$queryRaw<{ stars: number, rank: number, count: number }[]>`
        SELECT stars, rank, COUNT(*)::int as count
        FROM "Roster"
        WHERE stars >= 6
        GROUP BY stars, rank
        ORDER BY stars DESC, rank DESC
    `

    return distribution
}

export async function getPrestigeDistribution() {
    // Dynamic buckets of 250 prestige for a smooth curve
    const result = await prisma.$queryRaw<{ prestige: number, count: number }[]>`
        SELECT 
            (FLOOR("summonerPrestige" / 250) * 250)::int as prestige,
            COUNT(*)::int as count
        FROM "Player"
        WHERE "summonerPrestige" IS NOT NULL AND "summonerPrestige" > 0
        GROUP BY prestige
        ORDER BY prestige ASC
    `
    return result
}
