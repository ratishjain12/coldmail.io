"use server";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const handleSave = async (
  response: string,
  subject: string,
  category: string,
  workspaceId?: string
) => {
  const session = await auth.api.getSession({ headers: await headers() });

  try {
    // If workspaceId is provided, verify user has access to this workspace
    if (workspaceId) {
      const memberCheck = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: session?.user?.id!,
            workspaceId: workspaceId,
          },
        },
      });

      if (!memberCheck) {
        throw new Error("You don't have access to this workspace");
      }
    }

    // Fetch user once
    const user = await prisma.user.findUnique({
      where: { id: session?.user?.id! },
      select: { subscription: true, totalEmails: true, maxCapacity: true },
    });

    // Calculate new values
    let newTotalEmails = (user?.totalEmails ?? 0) + 1;
    let newMaxCapacity = user?.maxCapacity ?? false;

    if (
      user?.subscription === "free" &&
      newTotalEmails >= 8 &&
      !user.maxCapacity
    ) {
      newMaxCapacity = true;
    } else if (
      user?.subscription === "pro" &&
      newTotalEmails >= 20 &&
      !user.maxCapacity
    ) {
      newMaxCapacity = true;
    }

    // Transaction: create email and update user in one go
    const [email] = await prisma.$transaction([
      prisma.email.create({
        data: {
          authorId: session?.user?.id!,
          content: response,
          subject: subject,
          category: category,
          uniqueIdentifier: nanoid(),
          workspaceId: workspaceId || null,
          isPublic: workspaceId ? true : false,
        },
      }),
      prisma.user.update({
        where: { id: session?.user?.id! },
        data: {
          totalEmails: newTotalEmails,
          savedEmails: { increment: 1 },
          maxCapacity: newMaxCapacity,
        },
      }),
    ]);

    return email;
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const handleGet = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  try {
    const template = await prisma.user.findMany({
      include: {
        emails: {
          select: {
            id: true,
            content: true,
            category: true,
            subject: true,
            uniqueIdentifier: true,
          },
        },
      },
      where: {
        id: session?.user?.id!,
      },
    });
    return template;
  } catch (error) {
    console.log(error);
  }
};

export const handleDelete = async (emailId: string) => {
  const session = await auth.api.getSession({ headers: await headers() });
  try {
    const deletedItem = await prisma.email.delete({
      where: {
        id: emailId,
      },
    });

    if (deletedItem) {
      await prisma.user.update({
        where: {
          id: session?.user?.id,
        },
        data: {
          savedEmails: {
            decrement: 1,
          },
        },
      });
    }
    return deletedItem;
  } catch (error) {
    console.log(error);
  }
};

export const handleGetWithId = async (emailId: string) => {
  try {
    const getEmail = await prisma.email.findUnique({
      where: {
        id: emailId,
      },
    });

    return getEmail;
  } catch (error) {
    console.log(error);
  }
};

export const editTemplate = async (
  emailId: string,
  subject: string,
  content: string
) => {
  try {
    const editedEmail = await prisma.email.update({
      where: {
        id: emailId,
      },
      data: {
        subject: subject,
        content: content,
      },
    });

    return editedEmail;
  } catch (error) {
    console.log(error);
  }
};

export const getLimitStatus = async (id?: string) => {
  const session = await auth.api.getSession({ headers: await headers() });
  try {
    const limitStatus = await prisma.user.findUnique({
      where: {
        id: session?.user?.id || id,
      },
      select: {
        totalEmails: true,
        maxCapacity: true,
        subscription: true,
      },
    });
    return limitStatus;
  } catch (error) {
    console.log(error);
  }
};

export const fetchUserDetails = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  try {
    const userDetails = await prisma.user.findUnique({
      where: {
        id: session?.user?.id!,
      },
      select: {
        totalEmails: true,
        subscription: true,
        maxCapacity: true,
        savedEmails: true,
      },
    });
    return userDetails;
  } catch (error) {
    console.log(error);
  }
};

export const onPaymentSuccess = async (subscription: string, id: string) => {
  try {
    const userLimitStatus = await getLimitStatus(id);
    const user = await prisma.user.update({
      where: {
        id: id,
      },
      data: {
        subscription: subscription,
        maxCapacity: false,
        totalEmails: 0,
      },
    });
    return user;
  } catch (error) {
    console.log(error);
  }
};

export const handleGetWithUniqueId = async (uniqueIdentifier: string) => {
  try {
    const getEmail = await prisma.email.findFirst({
      where: {
        uniqueIdentifier: uniqueIdentifier,
      },
    });
    return getEmail;
  } catch (error) {
    console.log(error);
  }
};

// New server action for paginated templates
export const getTemplatesPaginated = async (
  page: number = 1,
  itemsPerPage: number = 8,
  category: string = "All"
) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    return { templates: [], totalCount: 0, totalPages: 0, currentPage: page };
  }

  try {
    const skip = (page - 1) * itemsPerPage;

    // Build where clause based on category
    const whereClause: any = {
      authorId: session.user.id,
    };

    if (category !== "All") {
      whereClause.category = category;
    }

    // Get total count for pagination
    const totalCount = await prisma.email.count({
      where: whereClause,
    });

    // Get paginated templates
    const templates = await prisma.email.findMany({
      where: whereClause,
      select: {
        id: true,
        content: true,
        category: true,
        subject: true,
        uniqueIdentifier: true,
      },
      orderBy: {
        id: "desc", // Most recent first
      },
      skip,
      take: itemsPerPage,
    });

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    return {
      templates,
      totalCount,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    console.log(error);
    return { templates: [], totalCount: 0, totalPages: 0, currentPage: page };
  }
};
