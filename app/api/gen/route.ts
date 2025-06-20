import { groq } from "@/lib/groq.helper";
import { emailFormType } from "@/app/(client)/templates/new/page";

export async function POST(request: Request) {
  const {
    senderName,
    emailTone,
    emailPurpose,
    subject,
    socialLinks,
    skills,
    model,
  }: emailFormType & { model: string } = await request.json();

  let links: string = socialLinks
    .map((socialLink) => `${socialLink.platform}: ${socialLink.link}`)
    .join(", ");

  let givenFactors: string[] = [
    "1. Only generate the email body.",
    "2. Do NOT include any introductory phrases (e.g., 'here is the email:', 'The email is as follows:', etc.). Start directly with the email content.",
    "3. Do NOT include the subject line.",
    "4. Start with a salutation: 'Dear xyz' or 'Respected xyz'.",
    "5. Use only 'Dear' and the recipient's name for the salutation.",
    `6. In the closing paragraph, before 'Sincerely,', ${
      socialLinks && socialLinks.length > 0
        ? `add exactly: 'You can reach me at the following: ${links}'.`
        : "do NOT mention any social links."
    }`,
  ];

  let purposeSpecificPrompt: string;
  let skillsOrFeaturesField: string = "";

  switch (emailPurpose) {
    case "follow-up":
      purposeSpecificPrompt = `Write a follow-up email referencing a previous application or conversation.\n- Briefly mention the previous conversation.\n- Politely ask about the current status or next steps.`;
      break;
    case "to-ceo":
      purposeSpecificPrompt = `Draft an email addressed to a CEO.\n- Be respectful and direct.\n- Highlight the most important request or information.`;
      skillsOrFeaturesField = `Skills to highlight: ${skills}`;
      break;
    case "job-application":
      purposeSpecificPrompt = `Draft a job application email.\n- Highlight key skills and experiences relevant to the job.\n- Express interest in the position and company.`;
      skillsOrFeaturesField = `Skills to highlight: ${skills}`;
      break;
    case "product-promotion":
      purposeSpecificPrompt = `Write a product promotion email.\n- Highlight key features and benefits.\n- Explain how the product solves a problem or improves the recipient's life/business (1-2 paragraphs).`;
      skillsOrFeaturesField = `Product features: ${skills}`;
      break;
    case "referrals":
      purposeSpecificPrompt = `Create a referral introduction email.\n- Briefly explain why you are reaching out.\n- Highlight how your skills are relevant for the job.`;
      break;
  }

  let promptString = `Generate an email with the following details:\nSender: ${senderName}\nPurpose: ${purposeSpecificPrompt}\nSubject: ${subject}\n${
    skillsOrFeaturesField ? skillsOrFeaturesField + "\n" : ""
  }Tone: ${emailTone}\nInstructions: ${givenFactors.join(
    " "
  )} Ensure the content and tone match the purpose and tone.`;

  // Add a system prompt for better control
  const systemPrompt =
    "You are a professional email generator. Strictly follow the user's instructions, do not add any extra commentary, and keep the output concise, relevant, and well-formatted as an email body.";

  const encoder = new TextEncoder();
  const stream = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: promptString,
      },
    ],
    model: model,
    stream: true,
  });

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          controller.enqueue(encoder.encode(content));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
