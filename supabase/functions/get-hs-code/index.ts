// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenAI, Type } from "npm:@google/genai";

// Initialize the Google AI client with the API key from environment variables
const ai = new GoogleGenAI(Deno.env.get("API_KEY")!);

serve(async (req) => {
  // CORS headers to allow requests from your web app
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  
  // Handle preflight OPTIONS request for CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { description } = await req.json();
    if (!description) {
      return new Response(JSON.stringify({ error: "Item description is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `
        Based on the following item description, suggest the top 3 most likely 6-digit Harmonized System (HS) codes.
        Provide a brief explanation for each code.

        Item Description: "${description}"
    `;

    // Define the expected JSON structure for the response
    const hsCodeSchema = {
        type: Type.OBJECT,
        properties: {
            code: { type: Type.STRING },
            description: { type: Type.STRING },
        },
        required: ['code', 'description']
    };
    
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            suggestions: {
                type: Type.ARRAY,
                items: hsCodeSchema
            }
        },
        required: ['suggestions']
    };

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });
    
    // The response text is a JSON string that matches the schema.
    const suggestions = JSON.parse(result.text);

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("HS Code Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});