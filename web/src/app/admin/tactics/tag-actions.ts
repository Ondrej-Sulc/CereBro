'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withActionContext } from "@/lib/with-request-context";

export const searchWarTags = withActionContext('searchWarTags', async (query: string) => {
  const session = await auth();
  if (!session?.user?.id) return [];

  return await prisma.tag.findMany({
    where: {
      name: { contains: query, mode: 'insensitive' },
      category: 'Alliance Wars'
    },
    take: 20,
    orderBy: { name: 'asc' }
  });
});
