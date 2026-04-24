import { groq } from '@ai-sdk/groq';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    
    // Authenticate the user calling the chat
    const { userId } = await auth();
    const internalUserId = userId || 'default-user';

    const result = streamText({
      model: groq('llama-3.3-70b-versatile'), // High-performance tool-use model
      system: `You are an intelligent, helpful financial assistant answering questions about the user's uploaded invoices. 
If the user asks questions about their invoices, use the \`getInvoices\` tool to fetch their data from the database first, then carefully answer their question using only the fetched data. Be concise and professional.`,
      messages,
      // @ts-ignore - Support maxSteps in tools for newer runtime
      maxSteps: 3, 
      tools: {
        getInvoices: tool({
          description: 'Fetch the dataset of all the user\'s currently uploaded invoices from the database',
          parameters: z.object({}),
          // @ts-ignore - Ignore generic inference error in older typings
          execute: async () => {
            try {
              // Call our NestJS backend endpoint securely over local network to fetch only the user's data
              const response = await fetch(`http://localhost:3001/invoices/user/${internalUserId}`);
              if (!response.ok) {
                return 'Failed to retrieve invoices from the database. Status: ' + response.status;
              }
              const data = await response.json();
              return { success: true, count: data.length, data };
            } catch (error) {
              return { success: false, error: 'Database network error' };
            }
          },
        }),
      },
    });

    // @ts-ignore fallback to whatever stream response the installed engine version uses
    return result.toDataStreamResponse ? result.toDataStreamResponse() : result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat AI Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process AI request' }), { status: 500 });
  }
}
